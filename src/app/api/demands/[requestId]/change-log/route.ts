import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { CHANGE_FIELD_LABELS } from '@/lib/demands/demandChangeLog';
import { submissionStatusLabel } from '@/components/demandFulfillment/statusStyles';

/** How many of the newest entries each source contributes. The merged list is cut to this too. */
const CHANGE_LOG_LIMIT = 500;

const ASSIGNMENT_CATEGORY_LABELS: Record<string, string> = {
  account_manager: 'Account Manager',
  costaff_spoc: 'SPOC',
  recruiter: 'Recruiter',
  client_spoc: 'Client SPOC',
};

const SUBMISSION_EVENT_LABELS: Record<string, string> = {
  status_change: 'Pipeline status',
  interview_scheduled: 'Interview scheduled',
  interview_feedback: 'Interview feedback',
  bgv_update: 'BGV',
  document_uploaded: 'Onboarding document',
  note: 'Note',
};

export interface ChangeLogEntry {
  id: string;
  at: string;
  /** demand = the demand's own fields; candidate = a candidate in this demand, any phase;
   *  assignment = who is on the demand; status = the demand's lifecycle status. */
  scope: 'demand' | 'candidate' | 'assignment' | 'status';
  actor: string | null;
  /** The candidate's or person's name, when the entry is about one. */
  subject: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
}

/**
 * GET /api/demands/[requestId]/change-log — one newest-first timeline of everything that
 * changed on a demand: its fields (demand_change_events, scope demand), its candidates' details
 * and onboarding steps (demand_change_events, scope candidate), pipeline moves and interview /
 * BGV events (submission_events), assignments (demand_assignment_events) and status changes
 * (demand_status_events). Each source keeps its own table; this route only reads and merges.
 * Same visibility as the demand itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;
    const demand = await loadDemandContext(requestId);
    if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const [changes, assignments, statuses, submissionEvents] = await Promise.all([
      prisma.demand_change_events.findMany({
        where: { demand_id: demand.id },
        orderBy: { created_at: 'desc' },
        take: CHANGE_LOG_LIMIT,
        include: { profiles: { select: { full_name: true } } },
      }),
      prisma.demand_assignment_events.findMany({
        where: { demand_id: demand.id },
        orderBy: { created_at: 'desc' },
        take: CHANGE_LOG_LIMIT,
      }),
      prisma.demand_status_events.findMany({
        where: { demand_id: demand.id },
        orderBy: { created_at: 'desc' },
        take: CHANGE_LOG_LIMIT,
        include: { profiles: { select: { full_name: true } } },
      }),
      prisma.submission_events.findMany({
        where: { submissions: { demand_id: demand.id } },
        orderBy: { created_at: 'desc' },
        take: CHANGE_LOG_LIMIT,
        include: {
          profiles: { select: { full_name: true } },
          submissions: { select: { candidates: { select: { full_name: true } } } },
        },
      }),
    ]);

    // Assignment rows store ids only; resolve people and client SPOCs (and the actors) in one go.
    const ids = [...new Set(assignments.flatMap((row) => [row.subject_id, row.created_by]).filter((id): id is string => !!id))];
    const [people, spocs] = ids.length
      ? await Promise.all([
          prisma.profiles.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true } }),
          prisma.company_spocs.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
        ])
      : [[], []];
    const names = new Map<string, string>([
      ...people.map((p) => [p.id, p.full_name] as const),
      ...spocs.map((s) => [s.id, s.name] as const),
    ]);

    const entries: ChangeLogEntry[] = [
      ...changes.map((row) => ({
        id: `c-${row.id}`,
        at: row.created_at.toISOString(),
        scope: row.scope === 'candidate' ? ('candidate' as const) : ('demand' as const),
        actor: row.profiles?.full_name ?? null,
        subject: row.entity_label,
        field: CHANGE_FIELD_LABELS[row.field] ?? row.field,
        old_value: row.old_value,
        new_value: row.new_value,
      })),
      ...assignments.map((row) => {
        const who = row.subject_label || (row.subject_id ? names.get(row.subject_id) ?? null : null);
        const label = ASSIGNMENT_CATEGORY_LABELS[row.category] ?? row.category;
        return {
          id: `a-${row.id}`,
          at: row.created_at.toISOString(),
          scope: 'assignment' as const,
          actor: row.created_by ? names.get(row.created_by) ?? null : null,
          subject: who,
          field: label,
          old_value: row.action === 'unassign' ? who : null,
          new_value: row.action === 'assign' ? who : null,
        };
      }),
      ...statuses.map((row) => ({
        id: `s-${row.id}`,
        at: row.created_at.toISOString(),
        scope: 'status' as const,
        actor: row.profiles?.full_name ?? null,
        subject: null,
        field: row.remark ? `Status (remark: ${row.remark})` : 'Status',
        old_value: row.from_status,
        new_value: row.to_status,
      })),
      ...submissionEvents.map((row) => {
        const isMove = row.event_type === 'status_change';
        return {
          id: `p-${row.id}`,
          at: row.created_at.toISOString(),
          scope: 'candidate' as const,
          actor: row.profiles?.full_name ?? null,
          subject: row.submissions.candidates?.full_name ?? null,
          field: SUBMISSION_EVENT_LABELS[row.event_type] ?? row.event_type.replace(/_/g, ' '),
          old_value: isMove ? (row.from_status ? submissionStatusLabel(row.from_status) : null) : null,
          new_value: isMove ? (row.to_status ? submissionStatusLabel(row.to_status) : null) : row.content,
        };
      }),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, CHANGE_LOG_LIMIT);

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/change-log:', error);
    return NextResponse.json({ error: 'Failed to load the change log' }, { status: 500 });
  }
}
