import { z } from 'zod';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { sendEmail, getCandidateInterviewEmailHtml, getAmInterviewNotificationEmailHtml } from '@/lib/email';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageInterview, canEditInterview, interviewEditBlockReason, buildInterviewReadScope, canViewInterview, canCreateInterviewFromModule } from '@/lib/auth/interviewPermissions';
import { recruiterProfileIds } from '@/lib/auth/recruiterRole';
import { INTERVIEW_CANCELLED_STATUS } from '@/lib/lifecycle/archive';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { getDemandOwnInterviewRounds } from '@/lib/demandFulfillment/interviewConfig';
import { candidateMatchesSkills } from '@/lib/skills';
import { isDemandRecruitmentActive } from '@/lib/demandFulfillment/constants';
import { dateOnlyField, timeOnlyField } from '@/components/demandFulfillment/demandFulfillment.schema';
import { INTERVIEW_LINK_STATUS_OPTIONS, INTERVIEW_COMPLETED_STATUS } from '@/constants/options';
import { interviewStatusError, loadInterviewStatuses } from '@/lib/interviewStatuses';
import { INTERVIEW_FILTER_FIELDS } from '@/constants/filters';
import { buildExactMatchWhere } from '@/lib/filter';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import { serializeInterview } from '@/lib/serializeInterview';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';

const LINK_STATUS_VALUES = INTERVIEW_LINK_STATUS_OPTIONS.map((o) => o.value) as [string, ...string[]];

const createInterviewSchema = z.object({
  candidate_id: z.string().uuid().optional(),
  candidate_name: z.string().trim().optional(),
  candidate_email: z.string().trim().email().optional().or(z.literal('')),
  demand_id: z.string().uuid().optional(),
  demand_request_id: z.string().trim().optional(),
  submission_id: z.string().uuid().optional(),
  // The configured round's real id (demand_interview_rounds.id) - validated against THIS
  // demand's own rounds server-side (getDemandOwnInterviewRounds), never free-typed text.
  // There is no separate `mode` field: Round and Mode are one field on the form, and the
  // round's own mode travels with it as a plain-text snapshot, resolved
  // server-side from that same round.
  round_id: z.string().uuid().optional(),
  skill_tested: z.string().trim().optional(),
  scheduled_date: dateOnlyField.optional(),
  // Start Time and End Time are REQUIRED on create - backend enforces presence and format.
  scheduled_time: timeOnlyField,
  end_time: timeOnlyField,
  // Auto-calculated client-side from scheduled_time/end_time - accepted as a plain value.
  duration_minutes: z.number().int().positive().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  link_status: z.enum(LINK_STATUS_VALUES).optional(),
  meeting_link: z.string().trim().url().optional().or(z.literal('')),
  feedback: z.string().trim().optional(),
  am_email: z.string().trim().email().optional().or(z.literal('')),
}).refine(
  (v) => v.end_time > v.scheduled_time,
  { message: 'End time must be after the start time', path: ['end_time'] }
);

const updateInterviewSchema = z.object({
  id: z.string().uuid(),
  status: z.string().trim().min(1).optional(),
  feedback: z.string().trim().optional(),
  round_id: z.string().uuid().optional(),
  scheduled_date: dateOnlyField.optional(),
  // Times are optional on update, but if BOTH are provided they must be valid and end > start.
  scheduled_time: timeOnlyField.optional(),
  end_time: timeOnlyField.optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  meeting_link: z.string().trim().url().optional().or(z.literal('')),
}).refine(
  (v) => !v.scheduled_time || !v.end_time || v.end_time > v.scheduled_time,
  { message: 'End time must be after the start time', path: ['end_time'] }
);

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const mode = searchParams.get('mode') || '';
    const status = searchParams.get('status') || '';
    const result = searchParams.get('result') || '';
    const round = searchParams.get('round') || '';
    const company = searchParams.get('company') || '';
    const am = searchParams.get('am') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const { page, pageSize, skip, take } = parsePagination(
      searchParams.get(PAGE_PARAM),
      searchParams.get(PAGE_SIZE_PARAM)
    );

    // Rule: Central read scope enforces TA sees own created, AM sees own demands.
    const readScope = buildInterviewReadScope({ role: currentUser.role, id: currentUser.userId });

    const demandConditions: Prisma.demandsWhereInput[] = [];
    if (readScope.demands) demandConditions.push(readScope.demands);
    if (company) {
      demandConditions.push({
        OR: [
          { company_id: company },
          { companies: { id: company } },
          { companies: { name: { equals: company, mode: 'insensitive' } } },
          { company_name: { equals: company, mode: 'insensitive' } },
        ],
      });
    }
    if (am) {
      demandConditions.push({
        OR: [
          { contact_profile_id: am },
          { profiles_demands_contact_profileToprofiles: { id: am } },
          { profiles_demands_contact_profileToprofiles: { full_name: { equals: am, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.interviewsWhereInput = {
      ...readScope,
      ...buildExactMatchWhere<Prisma.interviewsWhereInput>({
        [INTERVIEW_FILTER_FIELDS.mode]: mode,
        [INTERVIEW_FILTER_FIELDS.status]: status,
        [INTERVIEW_FILTER_FIELDS.result]: result,
        [INTERVIEW_FILTER_FIELDS.round]: round,
      }),
    };

    if (demandConditions.length > 0) {
      where.demands = { AND: demandConditions };
    }

    if (dateFrom || dateTo) {
      where.scheduled_date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    if (!status) {
      where.status = { not: INTERVIEW_CANCELLED_STATUS };
    }

    const searchTerm = search.trim();
    if (searchTerm) {
      where.OR = [
        { candidates: { full_name: { contains: searchTerm, mode: 'insensitive' } } },
        { candidates: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { demands: { request_id: { contains: searchTerm, mode: 'insensitive' } } },
        { demands: { job_title: { contains: searchTerm, mode: 'insensitive' } } },
        { profiles_interviews_created_byToprofiles: { full_name: { contains: searchTerm, mode: 'insensitive' } } },
        { profiles_interviews_created_byToprofiles: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [data, total, roundOptionRows, modeOptionRows, visibleDemandInterviews] = await prisma.$transaction([
      prisma.interviews.findMany({
        where,
        include: {
          candidates: { select: { full_name: true, email: true, phone: true } },
          demands: {
            select: {
              request_id: true, job_title: true, skill_description: true, client_name: true,
              company_name: true, company_email: true, company_id: true,
              created_by: true, contact_profile_id: true, spoc_profile_id: true,
              companies: { select: { id: true, name: true, client_name: true, email: true } },
              profiles_demands_contact_profileToprofiles: { select: { id: true, full_name: true, email: true } },
              demand_ta_allocations: { select: { ta_id: true } },
            },
          },
          profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
        },
        orderBy: [
          { scheduled_date: 'asc' },
          { scheduled_time: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
        skip,
        take,
      }),
      prisma.interviews.count({ where }),
      prisma.interviews.findMany({
        where: { ...readScope, level: { not: null } },
        distinct: ['level'],
        select: { level: true },
        orderBy: { level: 'asc' },
      }),
      prisma.interviews.findMany({
        where: { ...readScope, mode: { not: null } },
        distinct: ['mode'],
        select: { mode: true },
        orderBy: { mode: 'asc' },
      }),
      // Rule: Options include only companies/AMs present in visible interviews.
      prisma.interviews.findMany({
        where: { ...readScope, demands: { isNot: null } },
        distinct: ['demand_id'],
        select: {
          demands: {
            select: {
              company_id: true,
              company_name: true,
              companies: { select: { id: true, name: true } },
              contact_profile_id: true,
              profiles_demands_contact_profileToprofiles: { select: { id: true, full_name: true, email: true } },
            },
          },
        },
      }),
    ]);

    const recruiterRoleIds = await recruiterProfileIds(data.map((iv) => iv.created_by));

    const interviews = data.map(iv => {
      const { demands: demandRow, ...rest } = iv;
      const recruiterIds = demandRow
        ? demandRow.demand_ta_allocations.map((a) => a.ta_id).filter((id): id is string => !!id)
        : [];
      const actor = { role: currentUser.role, id: currentUser.userId };
      const creatorIsRecruiter = recruiterRoleIds.has(iv.created_by ?? '');
      const canManage = !!demandRow && canEditInterview(actor, demandRow, recruiterIds, iv.created_by, creatorIsRecruiter);
      const canAdd = !!demandRow && canManageInterview(actor, demandRow, recruiterIds);

      const clientCompanyName = demandRow?.companies?.name || demandRow?.company_name || null;
      const clientName = demandRow?.companies?.client_name || demandRow?.client_name || null;
      const clientCompanyEmail = demandRow?.companies?.email || demandRow?.company_email || null;
      const amName = demandRow?.profiles_demands_contact_profileToprofiles?.full_name || null;
      const amEmail = demandRow?.profiles_demands_contact_profileToprofiles?.email || null;

      return {
        ...serializeInterview(rest),
        candidate_name: iv.candidates?.full_name ?? null,
        candidate_email: iv.candidates?.email ?? null,
        demand_request_id: demandRow?.request_id ?? null,
        demand_job_title: demandRow?.job_title ?? null,
        client_company_name: clientCompanyName,
        client_name: clientName,
        client_company_email: clientCompanyEmail,
        am_name: amName,
        am_email: amEmail,
        created_by_name: iv.profiles_interviews_created_byToprofiles?.full_name ?? null,
        created_by_email: iv.profiles_interviews_created_byToprofiles?.email ?? null,
        can_manage: canManage,
        manage_blocked_reason: canManage
          ? null
          : interviewEditBlockReason(actor, recruiterIds, iv.created_by, creatorIsRecruiter),
        can_add: canAdd,
      };
    });

    const roundOptions = roundOptionRows.map((r) => r.level).filter((v): v is string => !!v);
    const modeOptions = modeOptionRows.map((r) => r.mode).filter((v): v is string => !!v);

    const companyMap = new Map<string, string>();
    const amMap = new Map<string, string>();
    for (const item of visibleDemandInterviews) {
      const d = item.demands;
      if (!d) continue;
      const cId = d.company_id || d.companies?.id;
      const cName = d.companies?.name || d.company_name;
      if (cName) {
        const key = cId || cName;
        if (!companyMap.has(key)) companyMap.set(key, cName);
      }
      const amId = d.contact_profile_id || d.profiles_demands_contact_profileToprofiles?.id;
      const amFullName = d.profiles_demands_contact_profileToprofiles?.full_name;
      if (amId && amFullName) {
        if (!amMap.has(amId)) amMap.set(amId, amFullName);
      }
    }

    const companyOptions = Array.from(companyMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const amOptions = Array.from(amMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({
      interviews,
      roundOptions,
      modeOptions,
      companyOptions,
      amOptions,
      ...buildPaginationMeta(total, page, pageSize),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in GET /api/interviews:', err);
    return NextResponse.json(
      { interviews: [], roundOptions: [], modeOptions: [], companyOptions: [], amOptions: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();

    // Only super_admin, ta and account_manager may reach this direct module entry point at
    // all (spoc/hr/viewer must schedule from a demand's Pipeline instead); the demand-scope
    // check further below (canManageInterview) still applies to everyone, including ta/AM.
    if (!canCreateInterviewFromModule(currentUser.role)) {
      return NextResponse.json(
        {
          error: 'You schedule interviews from a demand: open a demand you are assigned to, then Pipeline → the candidate → Schedule Interview.',
        },
        { status: 403 },
      );
    }

    const rawBody = await request.json();
    const parsed = createInterviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    // Resolve candidate_id from candidate_name if only a name string was sent, or verify
    // existence when a candidate_id was supplied directly (never trust a client-supplied id).
    let candidateId: string | undefined = body.candidate_id;
    if (candidateId) {
      const found = await prisma.candidates.findUnique({ where: { id: candidateId }, select: { id: true } });
      if (!found) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      }
    } else if (body.candidate_name) {
      const found = await prisma.candidates.findFirst({
        where: { full_name: { equals: body.candidate_name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      candidateId = found?.id;
    }

    // Resolve demand_id from demand_request_id string if needed, or verify existence when
    // a demand_id was supplied directly.
    let demandId: string | undefined = body.demand_id;
    if (demandId) {
      const found = await prisma.demands.findUnique({ where: { id: demandId }, select: { id: true } });
      if (!found) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
    } else if (body.demand_request_id) {
      const found = await prisma.demands.findFirst({
        where: { request_id: body.demand_request_id.trim() },
        select: { id: true },
      });
      demandId = found?.id;
    }

    // A directly-supplied submission_id must actually exist — never trusted blindly.
    if (body.submission_id) {
      const found = await prisma.submissions.findUnique({ where: { id: body.submission_id }, select: { id: true } });
      if (!found) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
    }

    // Every Interview must belong to a Demand — this is also what makes role-based
    // authorization possible (visibility/CRUD is derived from the Demand relationship,
    // never from interviews.created_by). An orphan interview would bypass authorization
    // entirely, so it's rejected outright rather than silently allowed.
    if (!demandId) {
      return NextResponse.json({ error: 'A Requirement must be selected to schedule an interview' }, { status: 400 });
    }

    const demand = await loadDemandContext(demandId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canManageInterview({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to schedule interviews for this requirement' }, { status: 403 });
    }

    // Demand status (NOT company status) gates interview scheduling — see the identical guard in
    // the demand-pipeline route. A terminal demand (Closure / Cancelled) is no longer an active
    // requisition; an INACTIVE company does NOT block scheduling on a demand that is still live.
    if (!isDemandRecruitmentActive(demand.status)) {
      return NextResponse.json(
        { error: `Interviews cannot be scheduled because this requirement is ${demandStatusLabel(demand.status)}. Reopen the requirement first.` },
        { status: 400 }
      );
    }

    // Candidate must actually belong to the selected Demand's pipeline (a submissions row
    // linking them) — matches the rule already enforced by the nested scheduling route. A
    // demand WITH required skills additionally requires the candidate's own skills to overlap
    // them — the same rule (and the same shared matcher) the Candidate field's client-side
    // filtering already applies, re-enforced here so a direct API call cannot bypass it. A
    // demand with no required skills has nothing to match against, so every pipeline candidate
    // is eligible (matches the field showing all of them in that case).
    if (candidateId && demandId) {
      const link = await prisma.submissions.findFirst({
        where: { candidate_id: candidateId, demand_id: demandId },
        select: { id: true },
      });
      if (!link) {
        return NextResponse.json({ error: "This candidate is not in the selected requirement's pipeline" }, { status: 400 });
      }
      if (demand.technology_stack.length > 0) {
        const candidate = await prisma.candidates.findUnique({ where: { id: candidateId }, select: { skills: true } });
        if (!candidateMatchesSkills(demand.technology_stack, candidate?.skills)) {
          return NextResponse.json({ error: "This candidate's skills do not match this requirement's required skills" }, { status: 400 });
        }
      }
    }

    // Interview Round must reference one of THIS demand's OWN saved rounds by real id — never a
    // free-typed value, and never the company/global fallback chain (getDemandOwnInterviewRounds,
    // not resolveInterviewRounds): a demand with no rounds of its own cannot have an interview
    // scheduled against it from this screen.
    const rounds = await getDemandOwnInterviewRounds(demandId);
    if (rounds.length === 0) {
      return NextResponse.json(
        { error: 'No interview rounds are configured for this requirement. Add them in Edit Demand first.' },
        { status: 400 }
      );
    }
    const roundId = body.round_id || rounds[0].id;
    const matchedRound = rounds.find((r) => r.id === roundId);
    if (!matchedRound) {
      return NextResponse.json(
        { error: 'The selected Interview Round is not configured for this demand', availableRounds: rounds.map((r) => ({ id: r.id, name: r.name })) },
        { status: 400 }
      );
    }

    // Interview Mode is not a separately chosen value: Round and Mode are one field, and the
    // mode is a plain-text snapshot of the selected round's own mode at schedule time — later
    // changes to the demand's (or company's) rounds never alter an already-scheduled interview.
    const mode = matchedRound.mode ?? '';

    const newInterview: any = {
      round_id: matchedRound?.id ?? null,
      level: matchedRound?.name ?? 'Technical', // denormalized display copy, derived from round_id
      skill_tested: body.skill_tested || 'Technical Skills',
      mode,
      scheduled_date: new Date(body.scheduled_date || new Date().toISOString().split('T')[0]),
      scheduled_time: body.scheduled_time
        ? new Date(`1970-01-01T${body.scheduled_time}:00Z`)
        : null,
      end_time: body.end_time
        ? new Date(`1970-01-01T${body.end_time}:00Z`)
        : null,
      duration_minutes: body.duration_minutes ?? null,
      // Every interview is created as 'Scheduled' — the create form no longer offers a status
      // picker, and 'Scheduled' is never a later transition target. Any status sent by an
      // older client is ignored rather than trusted.
      status: 'Scheduled',
      link_status: body.link_status || 'Client_Shared',
      meeting_link: body.meeting_link || null,
      feedback: body.feedback || '',
      created_by: currentUser.userId,
    };

    if (demandId) newInterview.demand_id = demandId;
    if (candidateId) newInterview.candidate_id = candidateId;
    if (body.submission_id) newInterview.submission_id = body.submission_id;

    const created = await prisma.interviews.create({
      data: newInterview,
      include: {
        candidates: { select: { full_name: true, email: true } },
        demands: { select: { request_id: true, skill_description: true } },
        profiles_interviews_created_byToprofiles: { select: { id: true, full_name: true, email: true } },
      },
    });

    const data = {
      ...serializeInterview(created),
      candidate_name: created.candidates?.full_name ?? body.candidate_name ?? null,
      candidate_email: created.candidates?.email ?? body.candidate_email ?? null,
      demand_request_id: created.demands?.request_id ?? body.demand_request_id ?? null,
      created_by_name: created.profiles_interviews_created_byToprofiles?.full_name ?? null,
      created_by_email: created.profiles_interviews_created_byToprofiles?.email ?? null,
    };

    // Dual Email Dispatch: 1. To Candidate, 2. To AM
    const candidateEmail = body.candidate_email?.trim() || created.candidates?.email || null;
    const amEmail = body.am_email?.trim() || null;

    if (candidateEmail) {
      sendEmail({
        to: candidateEmail,
        subject: `[Interview Invitation] ${data.skill_tested} (${data.level}) — Costaff Recruitment`,
        html: getCandidateInterviewEmailHtml(data),
      }).catch(e => console.error('Error sending candidate interview email:', e));
    }

    if (amEmail) {
      sendEmail({
        to: amEmail,
        subject: `[Costaff ATS] Interview Booked: Candidate ${data.candidate_name} for ${data.demand_request_id}`,
        html: getAmInterviewNotificationEmailHtml(data),
      }).catch(e => console.error('Error sending AM interview alert:', e));
    }

    return NextResponse.json({ interview: data, success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in POST /api/interviews:', err);
    return NextResponse.json({ error: 'Failed to schedule interview' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requireAuth();
    const rawBody = await request.json();
    const parsed = updateInterviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const {
      id, status, feedback, round_id, scheduled_date, scheduled_time, end_time, duration_minutes,
      meeting_link,
    } = parsed.data;

    const existing = await prisma.interviews.findUnique({ where: { id }, select: { demand_id: true, created_by: true, status: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    // Edit eligibility follows THIS interview's own STATUS, regardless of result — identical
    // to the PATCH /api/interviews/[id] route and to getInterviewRowActions, so this legacy
    // status-only endpoint can't be used to slip past the rule the UI enforces.
    if (status !== undefined) {
      const catalog = await loadInterviewStatuses(true);
      const statusError = interviewStatusError(status, existing.status, catalog, true);
      if (statusError) return NextResponse.json({ error: statusError }, { status: 400 });
    }
    if (existing.status === INTERVIEW_COMPLETED_STATUS) {
      return NextResponse.json(
        { error: 'A completed interview cannot be edited. Use the admin correction process if this was recorded in error.', blocked: true },
        { status: 409 }
      );
    }
    // Authorization is always derived from the Interview's Demand — an interview with no
    // linked demand has no ownership to check against, so only Super Admin may touch it
    // (fail-safe: never silently allow any authenticated user through). Edit is stricter
    // than view/create: a recruiter must also be the one who scheduled it.
    if (existing.demand_id) {
      const demand = await loadDemandContext(existing.demand_id);
      if (!demand) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
      const actor = { role: currentUser.role, id: currentUser.userId };
      const creatorIsRecruiter = (await recruiterProfileIds([existing.created_by])).has(existing.created_by ?? '');
      if (!canEditInterview(actor, demand, demand.recruiterIds, existing.created_by, creatorIsRecruiter)) {
        return NextResponse.json(
          { error: interviewEditBlockReason(actor, demand.recruiterIds, existing.created_by, creatorIsRecruiter) ?? 'You do not have permission to manage this demand\'s pipeline' },
          { status: 403 }
        );
      }
    } else if (currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'You do not have permission to manage this interview' }, { status: 403 });
    }

    let matchedRound: { id: string; name: string; round_order: number } | undefined;
    if (round_id !== undefined) {
      // Never keep an invalid Round -> Demand relationship: the round must belong to
      // this interview's own demand. An orphan interview with no demand has no config
      // to validate against, so a round_id change is rejected outright for it.
      if (!existing.demand_id) {
        return NextResponse.json({ error: 'This interview has no linked requirement, so its round cannot be changed' }, { status: 400 });
      }
      const rounds = await getDemandOwnInterviewRounds(existing.demand_id);
      matchedRound = rounds.find((r) => r.id === round_id);
      if (!matchedRound) {
        return NextResponse.json(
          { error: 'The selected Interview Round is not configured for this demand', availableRounds: rounds.map((r) => ({ id: r.id, name: r.name })) },
          { status: 400 }
        );
      }
    }

    const updateData: any = { updated_by: currentUser.userId };
    if (status) updateData.status = status;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (matchedRound) {
      updateData.round_id = matchedRound.id;
      updateData.level = matchedRound.name; // denormalized display copy, derived from round_id
    }
    if (scheduled_date !== undefined) updateData.scheduled_date = new Date(scheduled_date);
    if (scheduled_time !== undefined) updateData.scheduled_time = scheduled_time ? new Date(`1970-01-01T${scheduled_time}:00Z`) : null;
    if (end_time !== undefined) updateData.end_time = end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (meeting_link !== undefined) updateData.meeting_link = meeting_link || null;

    const updated = await prisma.interviews.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ interview: serializeInterview(updated), success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in PUT /api/interviews:', err);
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Interview ID is required' }, { status: 400 });
    }

    const existing = await prisma.interviews.findUnique({
      where: { id },
      select: {
        demand_id: true,
        created_by: true,
        status: true,
        demands: { select: { contact_profile_id: true, spoc_profile_id: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canViewInterview(actor, existing)) {
      return NextResponse.json({ error: 'You do not have permission to manage this interview' }, { status: 403 });
    }
    // Same fail-safe + creator-ownership rule as PUT: no linked demand means no ownership
    // to check, so only Super Admin may delete it; and a recruiter may only cancel /
    // archive an interview they scheduled.
    if (existing.demand_id) {
      const demand = await loadDemandContext(existing.demand_id);
      if (!demand) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
      const actor = { role: currentUser.role, id: currentUser.userId };
      const creatorIsRecruiter = (await recruiterProfileIds([existing.created_by])).has(existing.created_by ?? '');
      if (!canEditInterview(actor, demand, demand.recruiterIds, existing.created_by, creatorIsRecruiter)) {
        return NextResponse.json(
          { error: interviewEditBlockReason(actor, demand.recruiterIds, existing.created_by, creatorIsRecruiter) ?? 'You do not have permission to manage this demand\'s pipeline' },
          { status: 403 }
        );
      }
    } else if (currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'You do not have permission to manage this interview' }, { status: 403 });
    }

    // Hard delete — permanently removes the round from the pipeline timeline.
    // Eligibility is decided by THIS interview's own STATUS, regardless of its result: a
    // Completed interview is a finished, auditable record and must not be removed; every
    // other status (Scheduled / Client No-Show / Candidate No-Show) is deletable. This
    // mirrors getInterviewRowActions so the hidden Delete button and this 409 can never
    // disagree, and it is evaluated per round only.
    if (existing.status === INTERVIEW_COMPLETED_STATUS) {
      return NextResponse.json(
        {
          error: 'A completed interview cannot be deleted. Use the admin correction process if this was recorded in error.',
          blocked: true,
        },
        { status: 409 },
      );
    }

    await prisma.interviews.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: true, interviewId: id });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error in DELETE /api/interviews:', err);
    return NextResponse.json({ error: 'Failed to delete interview' }, { status: 500 });
  }
}
