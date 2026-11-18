import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { sendEmail, getAmDemandAssignedEmailHtml } from '@/lib/email';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { demandApiSchema, resolveWorkModes } from '@/components/demands/demand.schema';
import {
  assignmentEventRows,
  demandChangeSnapshot,
  diffFields,
  pickSent,
  recordDemandChanges,
  sentChangeFields,
} from '@/lib/demands/demandChangeLog';
import { buildRawIlikeWhere } from '@/lib/search';
import { buildRawExactMatchWhere } from '@/lib/filter';
import { DEMAND_SEARCH_TEXT_FIELDS, DEMAND_SEARCH_ARRAY_FIELDS } from '@/constants/search';
import { DEMAND_FILTER_FIELDS } from '@/constants/filters';
import { parsePagination, buildPaginationMeta, PAGE_PARAM, PAGE_SIZE_PARAM } from '@/lib/pagination';
import {
  DEMAND_WRITE_ROLES,
  DEMAND_DELETE_BLOCKED_MESSAGE,
  canEditDemand,
  canDeleteDemand,
} from '@/lib/auth/demandPermissions';
import { canCloneDemand } from '@/lib/auth/demandFulfillmentPermissions';
import {
  buildDemandVisibilityCondition,
  buildDemandManageableCondition,
  buildAssignedToMeCondition,
  buildDemandUploadableCondition,
} from '@/lib/auth/demandVisibility';
import { canUseCompany } from '@/lib/auth/companyPermissions';
import { DEMANDS_WITH_AGING_BASE } from '@/lib/demands/demandAgingQuery';
import { DEMAND_CLONE_ELIGIBILITY_NOTE } from '@/lib/demands/demandClone';
import { generateDemandRequestId, isDemandRequestIdTaken, lockDemandRequestIdSequence } from '@/lib/demands/demandRequestId';
import {
  duplicateDemandRequestIdMessage,
  normalizeDemandRequestId,
  validateDemandRequestId,
} from '@/lib/demands/demandRequestIdRules';
import { findOrCreateCompanyByName } from '@/lib/companies/companyMaster';
import { isCompanyActiveForNewDemand } from '@/components/companies/company.schema';
import { ALL_DEMAND_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import {
  syncMaterializedRounds,
  findInUseDemandRoundConflicts,
  describeInUseDemandRound,
  type InUseDemandRound,
} from '@/lib/demandFulfillment/interviewConfig';
import { seedCompanyRoundsIfEmpty } from '@/lib/companies/companyInterviewRounds';

import { isAllowedListId } from '@/lib/settingsListValidation';
import { demandMasterFieldError } from '@/lib/masters/demandFieldValidation';
import { notifyNewlyAssigned, loadAssignmentState } from '@/lib/notifications/createDemandAssignmentNotifications';
import { normalizeSkillsInput } from '@/lib/skills';

const DEMAND_RECRUITER_ROLES = ['ta'];
const AM_ASSIGN_FORBIDDEN_MESSAGE = 'Account Managers can only assign a demand to themselves';

const COMPENSATION_MAX_LENGTH = 50;

/** Compensation bounds are free text and are stored verbatim ("6LPA", "22 lakh", "6000").
 *  A number from an older client is accepted and stringified. "" / null means "not specified". */
function toCompensationText(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const text = String(v).trim();
  return text === '' ? null : text;
}

/** Rejects a bound longer than the VARCHAR(50) column rather than letting the DB throw. */
function compensationLengthError(field: 'Minimum' | 'Maximum', v: string | number | null | undefined): string | null {
  const text = toCompensationText(v);
  return text !== null && text.length > COMPENSATION_MAX_LENGTH
    ? `${field} Compensation must be ${COMPENSATION_MAX_LENGTH} characters or fewer`
    : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown inside the create transaction when the clone source has disappeared mid-write. */
class CloneSourceMissingError extends Error {
  constructor() {
    super('Clone source demand no longer exists');
    this.name = 'CloneSourceMissingError';
  }
}

/** Thrown inside the create transaction when the chosen Requirement ID is already taken. */
class DuplicateRequestIdError extends Error {
  constructor(requestId: string) {
    super(duplicateDemandRequestIdMessage(requestId));
    this.name = 'DuplicateRequestIdError';
  }
}

/** Thrown inside the update transaction when the edit would delete or rename an interview round
 *  that already has interviews on this demand. Rolling the transaction back is the point: the edit
 *  is rejected whole, so no other field of the same save is applied on top of a half-legal change. */
class InUseRoundError extends Error {
  conflicts: InUseDemandRound[];

  constructor(conflicts: InUseDemandRound[]) {
    super(conflicts.map(describeInUseDemandRound).join(' '));
    this.name = 'InUseRoundError';
    this.conflicts = conflicts;
  }
}

/** Validates contact_profile_id (AM) is an existing account_manager profile, and — if the actor is an AM — that it's themselves. */
async function validateAmAssignment(
  currentUser: { role: string; userId: string },
  amId: string
): Promise<{ profile: { role: string; full_name: string; email: string } } | { error: string; status: number }> {
  const profile = await prisma.profiles.findUnique({
    where: { id: amId },
    select: { role: true, full_name: true, email: true },
  });
  if (!profile || profile.role !== 'account_manager') {
    return { error: 'Account Manager must be an existing Account Manager profile', status: 400 };
  }
  if (currentUser.role === 'account_manager' && amId !== currentUser.userId) {
    return { error: AM_ASSIGN_FORBIDDEN_MESSAGE, status: 403 };
  }
  return { profile };
}

/** Validates spoc_profile_id is an existing spoc profile (no ownership restriction — AM may assign any SPOC). */
async function validateSpocAssignment(spocId: string): Promise<{ profile: { role: string; full_name: string; email: string } } | { error: string; status: number }> {
  const profile = await prisma.profiles.findUnique({
    where: { id: spocId },
    select: { role: true, full_name: true, email: true },
  });
  if (!profile || profile.role !== 'spoc') {
    return { error: 'SPOC must be an existing SPOC profile', status: 400 };
  }
  return { profile };
}

/**
 * Client-side SPOCs picked for a demand must belong to the demand's client. A newly picked SPOC
 * must be active; one already on the demand stays allowed after it is deactivated (grandfather
 * rule), so an unrelated edit never fails on it.
 */
async function clientSpocIdsError(companyId: string | null, ids: string[], currentIds: string[] = []): Promise<string | null> {
  if (ids.length === 0) return null;
  if (!companyId) return 'Pick a client before choosing client SPOCs';
  const spocs = await prisma.company_spocs.findMany({
    where: { id: { in: ids }, company_id: companyId },
    select: { id: true, is_active: true },
  });
  if (spocs.length !== new Set(ids).size) return "Every client SPOC must belong to this demand's client";
  if (spocs.some((spoc) => !spoc.is_active && !currentIds.includes(spoc.id))) {
    return 'An inactive client SPOC cannot be added to a demand';
  }
  return null;
}

function isValidationError<T>(result: T | { error: string; status: number }): result is { error: string; status: number } {
  return typeof result === 'object' && result !== null && 'error' in result;
}

/**
 * Resolves the Company a demand write should point at, and returns the denormalized mirror
 * values written alongside `company_id`.
 *
 * Order of resolution:
 *   1. an explicit `company_id` (what the Demand form sends) — must exist
 *   2. legacy `company_name`/`client_name` columns (bulk import, older clients) — resolved
 *      through the SAME create-or-reuse master path, so imports can't create duplicate companies
 *   3. neither -> no company, demand keeps null company_id (allowed; the form requires it)
 *
 * `client_name` / `company_name` / `company_email` are intentionally still written onto the
 * demand. They are the columns the dashboard aging table, Client & Source Analytics, both Excel
 * exports, demand search, the AM mandate email and the import column contract all read, so
 * mirroring keeps every one of them correct without changing them.
 */
async function resolveDemandCompany(
  values: {
    company_id?: string | null;
    company_name?: string | null;
    client_name?: string | null;
    company_email?: string | null;
  },
  /**
   * `'create'` enforces "a new Demand needs an ACTIVE company".
   *
   * `'update'` enforces the edit-mode equivalent: a Demand may KEEP the INACTIVE company it is
   * already on (going INACTIVE must never freeze or invalidate recruitment that is already
   * running), but it may not be MOVED onto an inactive company.
   *
   *   create → any INACTIVE company is refused.
   *   update → the Demand's OWN current company is always allowed; any OTHER inactive company
   *            is refused.
   *
   * @param currentCompanyId the Demand's existing company_id (update mode only), so "its own"
   *                         inactive company can be told apart from "some other inactive one".
   */
  mode: 'create' | 'update' = 'create',
  currentCompanyId?: string | null,
  /** The session actor — an AM may only attach a demand to a client they own. */
  actor?: { role?: string | null; id?: string | null } | null
): Promise<
  | { companyId: string; client_name: string | null; company_name: string | null; company_email: string | null }
  | { error: string; status: number }
> {
  /**
   * @param companyId  the company being assigned
   * @param companyName for the message
   */
  const rejectInactive = (companyId: string, companyName: string) =>
    mode === 'update' && companyId === currentCompanyId
      ? null // unchanged — the Demand already points here
      : {
          error:
            mode === 'update'
              ? `"${companyName}" is inactive, so this Demand cannot be moved to it. Choose an active company.`
              : `"${companyName}" is inactive, so a new Demand cannot be created against it. Set the company back to ACTIVE, or choose an active company.`,
          status: 400,
        };

  if (values.company_id) {
    const company = await prisma.companies.findUnique({
      where: { id: values.company_id },
      select: { id: true, name: true, client_name: true, email: true, status: true, account_manager_id: true },
    });
    if (!company) return { error: 'Company not found', status: 400 };
    // Enforced here, not only by the Company dropdown filtering to ACTIVE, so a direct API
    // call cannot bypass it.
    // Server-side re-check of the dropdown's AM scope: without it an AM could pass another AM's
    // company_id directly. Delivery Heads are unfiltered.
    if (actor && !canUseCompany(actor.role, actor.id, company.account_manager_id)) {
      return { error: 'Company not found', status: 404 };
    }
    if (!isCompanyActiveForNewDemand(company.status)) {
      const rejection = rejectInactive(company.id, company.name);
      if (rejection) return rejection;
    }
    return {
      companyId: company.id,
      client_name: company.client_name || company.name,
      company_name: company.name,
      company_email: company.email || null,
    };
  }

  const legacyName = values.company_name?.trim() || values.client_name?.trim();
  if (legacyName) {
    const { company } = await findOrCreateCompanyByName(legacyName, {
      client_name: values.client_name,
      email: values.company_email,
      // These quick-create paths collect no AM, so the actor manages the new client.
      manager: { account_manager_id: null, managed_by: actor?.id ?? null },
    });
    // findOrCreateCompanyByName may return an EXISTING company (bulk import, legacy clients),
    // which can be INACTIVE. The same rule applies, so imports cannot sneak a Demand onto a
    // retired company either.
    if (!isCompanyActiveForNewDemand(company.status)) {
      const rejection = rejectInactive(company.id, company.name);
      if (rejection) return rejection;
    }
    return {
      companyId: company.id,
      client_name: company.client_name || company.name,
      company_name: company.name,
      company_email: company.email || values.company_email?.trim() || null,
    };
  }

  return { companyId: '', client_name: null, company_name: null, company_email: null };
}

// Compensation bounds are free text; normalize "" to null so the client and
// formatCompensationRange() treat "unset" one way regardless of what was typed.
function serializeDemand<T extends { compensation_min?: unknown; compensation_max?: unknown }>(demand: T) {
  return {
    ...demand,
    compensation_min: toCompensationText(demand.compensation_min as string | number | null | undefined),
    compensation_max: toCompensationText(demand.compensation_max as string | number | null | undefined),
  };
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const roleType = searchParams.get('roleType') || '';
    const redFlagsOnly = searchParams.get('redFlagsOnly') === 'true';
    // Opt-in, narrower than the default visibility rule: "demands I can manage the pipeline
    // of" rather than "demands I may view". account_manager sees every demand by default
    // (DEMAND_VIEW_ALL_ROLES), so pickers that let an AM/TA choose a demand to act on (e.g.
    // "which Requirement is this candidate for?") must pass this to avoid offering a demand
    // the actual write would then 403 on.
    const manageableOnly = searchParams.get('manageable') === 'true';
    // "My demands" toggle on the Demands list (on by default for Recruiters). A filter, not an
    // access rule — visibility above still applies either way.
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    // "Which demand is this new candidate for?" — like `manageable`, but any Recruiter may
    // upload to any demand (canUploadProfilesToDemand), so they are not narrowed here.
    const uploadableOnly = searchParams.get('uploadable') === 'true';
    // Comma-separated demand statuses to EXCLUDE. Used by the Schedule New Interview Request ID
    // dropdown, which must offer only demands still eligible for recruitment (i.e. not Closure /
    // Cancelled). Values are validated against the real enum, so an unknown status is ignored
    // rather than silently widening or emptying the result set.
    const excludeStatuses = (searchParams.get('excludeStatuses') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => (ALL_DEMAND_STATUS_VALUES as string[]).includes(s));
    const { page, pageSize, skip, take } = parsePagination(
      searchParams.get(PAGE_PARAM),
      searchParams.get(PAGE_SIZE_PARAM)
    );

    const conditions: Prisma.Sql[] = [
      ...buildRawExactMatchWhere({
        [DEMAND_FILTER_FIELDS.status]: status,
        [DEMAND_FILTER_FIELDS.priority]: priority,
        [DEMAND_FILTER_FIELDS.roleType]: roleType,
      }),
      // Qualified with the subquery alias `v` (DEMANDS_WITH_AGING_BASE is wrapped as
      // `FROM (...) v`), matching every other condition in this list.
      ...(excludeStatuses.length > 0
        ? [Prisma.sql`(v.status IS NULL OR v.status NOT IN (${Prisma.join(excludeStatuses)}))`]
        : []),
    ];

    const visibilityCondition = buildDemandVisibilityCondition(currentUser);
    if (visibilityCondition) {
      conditions.push(visibilityCondition);
    }
    if (manageableOnly) {
      const manageableCondition = buildDemandManageableCondition(currentUser);
      if (manageableCondition) {
        conditions.push(manageableCondition);
      }
    }
    if (uploadableOnly) {
      const uploadableCondition = buildDemandUploadableCondition(currentUser);
      if (uploadableCondition) conditions.push(uploadableCondition);
    }
    if (assignedToMe) {
      const assignedCondition = buildAssignedToMeCondition(currentUser);
      if (assignedCondition) conditions.push(assignedCondition);
    }

    if (redFlagsOnly) {
      conditions.push(Prisma.sql`is_red_flag = true`);
    }
    const searchClause = buildRawIlikeWhere(search, DEMAND_SEARCH_TEXT_FIELDS, DEMAND_SEARCH_ARRAY_FIELDS);
    if (searchClause !== Prisma.empty) {
      conditions.push(searchClause);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [data, countResult] = await Promise.all([
      prisma.$queryRaw<unknown[]>`
        SELECT * FROM (${DEMANDS_WITH_AGING_BASE}) v
        ${whereClause}
        ORDER BY opened_at DESC
        LIMIT ${take} OFFSET ${skip}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM (${DEMANDS_WITH_AGING_BASE}) v
        ${whereClause}
      `,
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      demands: data || [],
      ...buildPaginationMeta(total, page, pageSize),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in /api/demands:', error);
    return NextResponse.json({ demands: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(DEMAND_WRITE_ROLES);
    const body = await request.json();

    const parsed = demandApiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    // Compensation is stored verbatim as free text — no parsing, no ordering check,
    // so any of "6LPA", "22 lakh", "6000" round-trips to the display unchanged.
    const minLengthError = compensationLengthError('Minimum', values.compensation_min);
    if (minLengthError) return NextResponse.json({ error: minLengthError }, { status: 400 });
    const maxLengthError = compensationLengthError('Maximum', values.compensation_max);
    if (maxLengthError) return NextResponse.json({ error: maxLengthError }, { status: 400 });
    values.compensation_min = toCompensationText(values.compensation_min);
    values.compensation_max = toCompensationText(values.compensation_max);

    let compensationCurrency: { id: string; code: string; name: string; symbol: string; is_active: boolean } | null = null;
    if (values.compensation_currency_id) {
      compensationCurrency = await prisma.compensation_currencies.findUnique({ where: { id: values.compensation_currency_id } });
      if (!compensationCurrency) {
        return NextResponse.json({ error: 'Selected currency was not found' }, { status: 400 });
      }
      if (!isAllowedListId(compensationCurrency.id, undefined, compensationCurrency.is_active ? [compensationCurrency.id] : [])) {
        return NextResponse.json({ error: 'Selected currency is inactive' }, { status: 400 });
      }
    }
    let compensationType: { id: string; name: string; is_active: boolean } | null = null;
    if (values.compensation_type_id) {
      compensationType = await prisma.compensation_types.findUnique({ where: { id: values.compensation_type_id } });
      if (!compensationType) {
        return NextResponse.json({ error: 'Selected compensation type was not found' }, { status: 400 });
      }
      if (!isAllowedListId(compensationType.id, undefined, compensationType.is_active ? [compensationType.id] : [])) {
        return NextResponse.json({ error: 'Selected compensation type is inactive' }, { status: 400 });
      }
    }

    const amResult = await validateAmAssignment(currentUser, values.contact_profile_id);
    if (isValidationError(amResult)) {
      return NextResponse.json({ error: amResult.error }, { status: amResult.status });
    }
    const amProfile = amResult.profile;

    let spocProfile: { role: string; full_name: string; email: string } | null = null;
    if (values.spoc_profile_id) {
      const spocResult = await validateSpocAssignment(values.spoc_profile_id);
      if (isValidationError(spocResult)) {
        return NextResponse.json({ error: spocResult.error }, { status: spocResult.status });
      }
      spocProfile = spocResult.profile;
    }

    const recruiterProfiles = await prisma.profiles.findMany({
      where: { id: { in: values.recruiter_ids } },
      select: { id: true, role: true },
    });
    if (
      recruiterProfiles.length !== values.recruiter_ids.length ||
      recruiterProfiles.some((p) => !DEMAND_RECRUITER_ROLES.includes(p.role))
    ) {
      return NextResponse.json({ error: 'All recruiters must be existing Recruiter (TA) profiles' }, { status: 400 });
    }

    // Experience Level is an optional select fed by Demand Fulfillment Settings. An empty value
    // ── Company resolution ────────────────────────────────────────────────────────
    // Resolves company_id and the denormalized mirror columns. A Clone reuses the source
    // demand's company by default (the form pre-fills company_id) and never creates a company.
    const companyResolution = await resolveDemandCompany(values, 'create', null, {
      role: currentUser.role,
      id: currentUser.userId,
    });
    if (isValidationError(companyResolution)) {
      return NextResponse.json({ error: companyResolution.error }, { status: companyResolution.status });
    }
    const companyFields = companyResolution.companyId
      ? {
          company_id: companyResolution.companyId,
          client_name: companyResolution.client_name,
          company_name: companyResolution.company_name,
          company_email: companyResolution.company_email,
        }
      : { company_id: null, client_name: null, company_name: null, company_email: null };

    const workModes = resolveWorkModes(values);
    if (!workModes || workModes.length === 0) {
      return NextResponse.json({ error: 'Select at least one work mode' }, { status: 400 });
    }
    const clientSpocIds = [...new Set(values.client_spoc_ids ?? [])];
    const clientSpocError = await clientSpocIdsError(companyFields.company_id, clientSpocIds);
    if (clientSpocError) return NextResponse.json({ error: clientSpocError }, { status: 400 });

    // Rule: the role category must be an ACTIVE skill_categories row; blank means "none".
    const activeSkillCategoryIds = (await prisma.skill_categories.findMany({
      where: { is_active: true },
      select: { id: true },
    })).map((c) => c.id);
    if (!isAllowedListId(values.skills_category_id ?? null, undefined, activeSkillCategoryIds)) {
      return NextResponse.json({ error: 'Selected skill group was not found or is inactive' }, { status: 400 });
    }
    const skillsCategoryId = values.skills_category_id ?? null;

    if (!values.role_category?.trim()) {
      return NextResponse.json({ error: 'Select a demand category' }, { status: 400 });
    }
    const masterError = await demandMasterFieldError({
      role_category: values.role_category,
      demand_type: values.demand_type || null,
      locations: values.locations,
      end_client_id: values.end_client_id || null,
    });
    if (masterError) return NextResponse.json({ error: masterError }, { status: 400 });

    // ── Clone Demand ──────────────────────────────────────────────────────────────
    // `cloned_from_demand_id` is sent ONLY by the Clone Demand action, which opens this
    // SAME Create Demand form pre-filled from an already-Closed demand (see
    // buildDemandCloneForm in src/lib/demands/demandClone.ts). Everything below
    // re-validates it server-side — hiding the button in the UI is UX, not the security
    // boundary. Nothing here modifies the source demand: it stays exactly as it was
    // (Closed, with its own candidates/interviews/history untouched).
    const clonedFromDemandId = typeof body?.cloned_from_demand_id === 'string' ? body.cloned_from_demand_id.trim() : '';
    let cloneSource: { id: string; requestId: string } | null = null;
    if (clonedFromDemandId) {
      if (!UUID_RE.test(clonedFromDemandId)) {
        return NextResponse.json({ error: 'Source demand for Clone is not a valid demand' }, { status: 400 });
      }
      const sourceDemand = await prisma.demands.findUnique({
        where: { id: clonedFromDemandId },
        select: { id: true, request_id: true, status: true, created_by: true, contact_profile_id: true, spoc_profile_id: true },
      });
      if (!sourceDemand) {
        return NextResponse.json({ error: 'Source demand for Clone not found' }, { status: 404 });
      }
      // RBAC: Super Admin over any Demand, or the Account Manager who owns it — the same
      // rule as every other demand-level write (canCloneDemand === canChangeDemandStatus).
      if (!canCloneDemand({ role: currentUser.role, id: currentUser.userId }, sourceDemand)) {
        return NextResponse.json({ error: 'You do not have permission to clone this demand' }, { status: 403 });
      }
      // Clone is available for a Demand in ANY status. There is deliberately no status gate here:
      // once a demand exists and the user can see it, they can reuse its configuration as the
      // starting point for another requirement (the same company routinely needs several similar
      // demands), and requiring it to be closed first made the feature undiscoverable and
      // needlessly blocked legitimate reuse.
      //
      // What IS still enforced: RBAC (canCloneDemand, above — the same ownership rule as every
      // other demand write) and the Company rule below — a clone is a NEW demand, so it must use
      // an ACTIVE company exactly like a manually created one, and cannot carry the source's
      // Request ID or any pipeline/runtime data.
      cloneSource = { id: sourceDemand.id, requestId: sourceDemand.request_id };
    }

    // Requirement ID ("CSF-2026-NNNN"): keep the caller's when given, otherwise generate a
    // fresh sequential one. A clone must never reuse the source's Requirement ID.
    // `demands.request_id` has no DB uniqueness constraint, so an explicitly supplied ID
    // that already exists is rejected rather than silently creating two Demands that
    // share one — matching the bulk-import path. Generating an ID, by contrast, happens
    // inside the write transaction under an advisory lock (see the $transaction below).
    const requestedRequestId = normalizeDemandRequestId(values.request_id ?? '');
    if (requestedRequestId) {
      // Rule: the browser is not a trust boundary, so the form rules are enforced here too.
      // A blank value keeps auto-generating, unchanged.
      const validation = validateDemandRequestId(requestedRequestId);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error, field: 'request_id' }, { status: 400 });
      }
    }
    if (requestedRequestId && cloneSource && requestedRequestId.toUpperCase() === cloneSource.requestId.trim().toUpperCase()) {
      return NextResponse.json({ error: 'A cloned Demand must get its own new Request ID' }, { status: 400 });
    }

    // Clone audit trail, stored on the new Demand. Nothing pipeline-shaped (submissions,
    // interviews, offers, onboarding/BGV, status history) is ever read off the source, so
    // the source keeps exclusive ownership of all of it.
    const cloneAuditFields = cloneSource
      ? { cloned_from_demand_id: cloneSource.id, cloned_by: currentUser.userId, cloned_at: new Date() }
      : {};

    let created: { demand: any; notificationsCreated: number };
    try {
      created = await prisma.$transaction(async (tx) => {
        // Serialize Requirement-ID generation with every other concurrent create, so
        // "highest + 1" can't be handed to two demands at once. The lock is released when
        // this transaction commits (or rolls back), by which point everyone queued behind
        // it can see the row this one wrote.
        await lockDemandRequestIdSequence(tx);

        const request_id =
          requestedRequestId || (await generateDemandRequestId(tx));
        if (await isDemandRequestIdTaken(request_id, tx)) {
          throw new DuplicateRequestIdError(request_id);
        }

        // Re-check the clone source inside the transaction: it may have been deleted
        // between the pre-flight check above and this write. Status is deliberately NOT
        // re-checked — any status is cloneable (see the note on DEMAND_CLONE_ELIGIBILITY_NOTE).
        // The throw aborts the whole transaction, so no partial Demand is left behind (and no
        // demand row is written without its recruiter allocations).
        if (cloneSource) {
          const sourceNow = await tx.demands.findUnique({
            where: { id: cloneSource.id },
            select: { id: true },
          });
          if (!sourceNow) {
            throw new CloneSourceMissingError();
          }
        }

        const created = await tx.demands.create({
          data: {
            request_id,
            ...companyFields,
            job_title: values.job_title.trim(),
            skill_description: values.skill_description.trim(),
            role_category: values.role_category,
            demand_type: values.demand_type?.trim() || null,
            engagement_type: values.engagement_type || null,
            client_demand_id: values.client_demand_id?.trim() || null,
            intermediary_partner: values.intermediary_partner?.trim() || null,
            shift_timings: values.shift_timings?.trim() || null,
            comments: values.comments?.trim() || null,
            other_details: values.other_details?.trim() || null,
            customer_jd: values.customer_jd?.trim() || null,
            customer_jd_file_url: values.customer_jd_file_url || null,
            customer_jd_file_name: values.customer_jd_file_url ? values.customer_jd_file_name?.trim() || null : null,
            client_spoc_ids: clientSpocIds,
            total_experience: values.total_experience?.trim() || null,
            relevant_experience: values.relevant_experience?.trim() || null,
            certifications: values.certifications ?? [],
            end_client_id: values.end_client_id || null,
            skills_category_id: skillsCategoryId,
            // Free-text chip list, entered exactly like Locations — not tied to any master list.
            experience_levels: normalizeSkillsInput(values.experience_levels),
            technology_stack: normalizeSkillsInput(values.required_skills),
            work_mode: workModes[0],
            work_modes: workModes,
            contact_profile_id: values.contact_profile_id,
            spoc_profile_id: values.spoc_profile_id || null,
            num_positions: values.num_positions ?? 1,
            // Create always starts Open. The form does not offer a status picker on create.
            status: 'Open',
            priority: values.priority,
            compensation_currency_id: values.compensation_currency_id || null,
            compensation_type_id: values.compensation_type_id || null,
            compensation_min: toCompensationText(values.compensation_min),
            compensation_max: toCompensationText(values.compensation_max),
            // Preserve original free-text for display (e.g. "16LPA", "22 lakh")
            locations: values.locations,
            created_by: currentUser.userId,
            updated_by: currentUser.userId,
            ...cloneAuditFields,
          },
        });
        await tx.demand_ta_allocations.createMany({
          data: values.recruiter_ids.map((ta_id) => ({ demand_id: created.id, ta_id })),
        });
        // Change log: the initial team, so the Assignments history starts at creation.
        const initialAssignmentEvents = [
          ...assignmentEventRows({ demandId: created.id, category: 'account_manager', previousIds: [], nextIds: [values.contact_profile_id], actorId: currentUser.userId }),
          ...assignmentEventRows({ demandId: created.id, category: 'costaff_spoc', previousIds: [], nextIds: [values.spoc_profile_id], actorId: currentUser.userId }),
          ...assignmentEventRows({ demandId: created.id, category: 'recruiter', previousIds: [], nextIds: values.recruiter_ids, actorId: currentUser.userId }),
          ...assignmentEventRows({ demandId: created.id, category: 'client_spoc', previousIds: [], nextIds: clientSpocIds, actorId: currentUser.userId }),
        ];
        if (initialAssignmentEvents.length > 0) {
          await tx.demand_assignment_events.createMany({ data: initialAssignmentEvents });
        }
        // Demand-level interview-round override, saved INSIDE the same transaction as the
        // demand so a failure can never leave a demand whose rounds disagree with it. Only
        // persisted when the user actually configured rounds — otherwise the demand keeps
        // inheriting Company -> global (resolveConfiguredRounds).
if (values.interview_rounds && values.interview_rounds.length > 0) {
          await tx.demand_interview_config.upsert({
            where: { demand_id: created.id },
            update: { rounds: values.interview_rounds as any, updated_by: currentUser.userId },
            create: { demand_id: created.id, rounds: values.interview_rounds as any, updated_by: currentUser.userId },
          });

          // FIRST-TIME SEED ONLY. A demand may configure the company's rounds exactly once —
          // when the company has none at all — and never as a "replace". This is the single
          // write path a demand has onto company_interview_rounds; from here on the company's
          // rounds are changed only from Clients Master, and only a NEW demand inherits a
          // change made there. It runs inside the demand transaction, under the company row
          // lock, and re-checks "still zero rounds?" at write time, so two concurrent saves
          // can never overwrite each other or clobber a configuration someone set meanwhile.
          // An empty rounds list (this branch is not entered) never touches the company.
          if (companyFields.company_id) {
            await seedCompanyRoundsIfEmpty(tx, companyFields.company_id, values.interview_rounds);
          }
        }

        // In-app notifications for the assigned SPOC / recruiter(s). Inside the same
        // transaction as the Demand, so a failed create can never leave notifications behind
        // (spec §6). "Previous" is empty for a brand-new Demand, so every assigned SPOC /
        // recruiter is newly assigned and gets exactly one notification; when neither is
        // assigned, nothing is created (spec §6).
        const notificationsCreated = await notifyNewlyAssigned(tx, {
          demandId: created.id,
          requestId: created.request_id,
          jobTitle: created.job_title ?? created.skill_description,
          previous: { spocId: null, recruiterIds: [] },
          next: {
            spocId: values.spoc_profile_id || null,
            recruiterIds: values.recruiter_ids,
          },
          actorId: currentUser.userId,
        });

        return { demand: created, notificationsCreated };
      });
    } catch (dbError) {
      if (dbError instanceof CloneSourceMissingError) {
        return NextResponse.json(
          { error: 'The source demand no longer exists, so it cannot be cloned' },
          { status: 400 }
        );
      }
      if (dbError instanceof DuplicateRequestIdError) {
        return NextResponse.json({ error: dbError.message, code: 'DUPLICATE_REQUEST_ID', field: 'request_id' }, { status: 409 });
      }
      console.error('Error creating demand:', dbError);
      console.error('Payload sent to database:', JSON.stringify(values, null, 2));
      return NextResponse.json({ error: dbError instanceof Error ? dbError.message : 'Failed to create demand' }, { status: 400 });
    }

    const data = created.demand;
    const serialized = serializeDemand(data);

    // Materialize this demand's interview rounds (demand_interview_rounds — what
    // interviews.round_id references) so the configuration is immediately live. Runs after the
    // demand transaction committed; safe to retry because syncMaterializedRounds is idempotent
    // and matches rows by name.
    if (values.interview_rounds && values.interview_rounds.length > 0) {
      await syncMaterializedRounds(
        data.id,
        values.interview_rounds.map((r) => ({ name: r.name, order: r.order, mandatory: !!r.mandatory, mode: r.mode ?? null }))
      ).catch((e) => console.error('Error materializing interview rounds for new demand:', e));
    }

    // Notify the assigned AM (and SPOC, if any) via email
    const notifyProfiles = [amProfile, spocProfile].filter((p): p is NonNullable<typeof p> => !!p?.email);
    for (const profile of notifyProfiles) {
      sendEmail({
        to: profile.email,
        subject: `[Costaff ATS] New Client Mandate Assigned: ${data.request_id} — ${data.job_title || data.skill_description}`,
        html: getAmDemandAssignedEmailHtml({
          ...serialized,
          am_name: profile.full_name,
          client_name: data.client_name,
          compensation_currency_symbol: compensationCurrency?.symbol,
          compensation_currency_code: compensationCurrency?.code,
          compensation_type_name: compensationType?.name,
        })
      }).catch(e => console.error('Error triggering assignee email:', e));
    }

    return NextResponse.json({ demand: serialized, notificationsCreated: created.notificationsCreated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands:', error);
    return NextResponse.json({ error: 'Failed to create demand' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requireRole(DEMAND_WRITE_ROLES);
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Demand ID is required' }, { status: 400 });
    }

    const existingDemand = await prisma.demands.findUnique({
      where: { id },
      select: {
        request_id: true,
        skills_category_id: true,
        created_by: true,
        contact_profile_id: true,
        status: true,
        company_id: true,
        compensation_currency_id: true,
        compensation_type_id: true,
        role_category: true,
        demand_type: true,
        locations: true,
        end_client_id: true,
        spoc_profile_id: true,
        client_spoc_ids: true,
        // Read for the change log's before-snapshot (see demandChangeSnapshot).
        job_title: true,
        skill_description: true,
        customer_jd: true,
        customer_jd_file_name: true,
        total_experience: true,
        relevant_experience: true,
        certifications: true,
        engagement_type: true,
        client_demand_id: true,
        intermediary_partner: true,
        shift_timings: true,
        comments: true,
        other_details: true,
        technology_stack: true,
        experience_levels: true,
        work_mode: true,
        work_modes: true,
        num_positions: true,
        priority: true,
        compensation_min: true,
        compensation_max: true,
        end_clients: { select: { name: true } },
        skill_categories: { select: { name: true } },
        compensation_currencies: { select: { code: true } },
        compensation_types: { select: { name: true } },
      },
    });
    if (!existingDemand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canEditDemand({ role: currentUser.role, id: currentUser.userId }, existingDemand)) {
      return NextResponse.json({ error: 'You can only edit Demands you own' }, { status: 403 });
    }

    const parsed = demandApiSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    // In Zod 4 `.partial()` still materializes a field's `.default()`, so a body that
    // omits `recruiter_ids` / `locations` / `required_skills` parses to `[]` rather
    // than `undefined`. Keying these three off the parsed data would make "field not
    // sent" indistinguishable from "set to empty", so a partial edit such as
    // PUT { id, job_title } would silently clear the demand's locations and skills AND
    // delete every demand_ta_allocations row — revoking the assigned Recruiters'
    // access to the demand as a side effect of renaming a job title. Recruiter
    // assignment is the authorization boundary for candidate/interview permissions, so
    // an unsent field must mean "leave unchanged" and removal stays an explicit act
    // (POST /api/demands/[requestId]/assign, or a body that really carries the key).
    const sent = (key: 'recruiter_ids' | 'locations' | 'required_skills' | 'experience_levels') =>
      Object.prototype.hasOwnProperty.call(body, key);

    // Compensation bounds are free text and are written verbatim. `undefined` still means
    // "field not sent" (leave the column alone); "" is normalized to null (clear it).
    if (values.compensation_min !== undefined) {
      const err = compensationLengthError('Minimum', values.compensation_min);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      values.compensation_min = toCompensationText(values.compensation_min);
    }
    if (values.compensation_max !== undefined) {
      const err = compensationLengthError('Maximum', values.compensation_max);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      values.compensation_max = toCompensationText(values.compensation_max);
    }

    if (values.compensation_currency_id) {
      const currency = await prisma.compensation_currencies.findUnique({ where: { id: values.compensation_currency_id } });
      if (!currency) {
        return NextResponse.json({ error: 'Selected currency was not found' }, { status: 400 });
      }
      if (!isAllowedListId(currency.id, existingDemand.compensation_currency_id, currency.is_active ? [currency.id] : [])) {
        return NextResponse.json({ error: 'Selected currency is inactive' }, { status: 400 });
      }
    }
    if (values.compensation_type_id) {
      const compType = await prisma.compensation_types.findUnique({ where: { id: values.compensation_type_id } });
      if (!compType) {
        return NextResponse.json({ error: 'Selected compensation type was not found' }, { status: 400 });
      }
      if (!isAllowedListId(compType.id, existingDemand.compensation_type_id, compType.is_active ? [compType.id] : [])) {
        return NextResponse.json({ error: 'Selected compensation type is inactive' }, { status: 400 });
      }
    }

    // Rule: the saved category is grandfathered, so a deactivated one never blocks an edit.
    if (values.skills_category_id !== undefined && values.skills_category_id !== null) {
      const activeSkillCategoryIds = (await prisma.skill_categories.findMany({
        where: { is_active: true },
        select: { id: true },
      })).map((c) => c.id);
      if (!isAllowedListId(values.skills_category_id, existingDemand.skills_category_id, activeSkillCategoryIds)) {
        return NextResponse.json({ error: 'Selected skill group was not found or is inactive' }, { status: 400 });
      }
    }

    const masterError = await demandMasterFieldError(
      {
        role_category: values.role_category,
        demand_type: values.demand_type,
        locations: sent('locations') ? values.locations : undefined,
        end_client_id: values.end_client_id || null,
      },
      {
        role_category: existingDemand.role_category,
        demand_type: existingDemand.demand_type,
        locations: existingDemand.locations,
        end_client_id: existingDemand.end_client_id,
      }
    );
    if (masterError) return NextResponse.json({ error: masterError }, { status: 400 });

    // `undefined` = the client did not mention the field, so leave the column alone.
    const nextRecruiterIds = sent('recruiter_ids') ? (values.recruiter_ids ?? []) : undefined;

    const workModes = resolveWorkModes(values);
    if (workModes !== undefined && workModes.length === 0) {
      return NextResponse.json({ error: 'Select at least one work mode' }, { status: 400 });
    }
    const nextClientSpocIds = values.client_spoc_ids !== undefined ? [...new Set(values.client_spoc_ids)] : undefined;
    if (nextClientSpocIds !== undefined) {
      const clientSpocError = await clientSpocIdsError(existingDemand.company_id, nextClientSpocIds, existingDemand.client_spoc_ids);
      if (clientSpocError) return NextResponse.json({ error: clientSpocError }, { status: 400 });
    }

    // Only Super Admin may change the Account Manager on an existing Demand — an AM's
    // own ownership is fixed once set (at creation) and cannot be re-asserted or
    // changed by them on update, even to themselves. Silently drop the field for an
    // AM actor rather than rejecting, since the frontend form doesn't even show this
    // selector to them and may still submit their own id as part of defaultValues.
    let amProfile: { role: string; full_name: string; email: string } | null = null;
    if (values.contact_profile_id !== undefined && currentUser.role !== 'account_manager') {
      const amResult = await validateAmAssignment(currentUser, values.contact_profile_id);
      if (isValidationError(amResult)) {
        return NextResponse.json({ error: amResult.error }, { status: amResult.status });
      }
      amProfile = amResult.profile;
    } else {
      values.contact_profile_id = undefined;
    }

    let spocProfile: { role: string; full_name: string; email: string } | null = null;
    if (values.spoc_profile_id !== undefined && values.spoc_profile_id !== null) {
      const spocResult = await validateSpocAssignment(values.spoc_profile_id);
      if (isValidationError(spocResult)) {
        return NextResponse.json({ error: spocResult.error }, { status: spocResult.status });
      }
      spocProfile = spocResult.profile;
    }

    if (nextRecruiterIds !== undefined) {
      const recruiterProfiles = await prisma.profiles.findMany({
        where: { id: { in: nextRecruiterIds } },
        select: { id: true, role: true },
      });
      if (
        recruiterProfiles.length !== nextRecruiterIds.length ||
        recruiterProfiles.some((p) => !DEMAND_RECRUITER_ROLES.includes(p.role))
      ) {
        return NextResponse.json({ error: 'All recruiters must be existing Recruiter (TA) profiles' }, { status: 400 });
      }
    }

    const updateData: Prisma.demandsUncheckedUpdateInput = {};

    // ── Company ──────────────────────────────────────────────────────────────────
    // Re-resolve whenever the write names a company (explicit company_id, or legacy
    // company_name/client_name). `company_id: null` is honoured as "clear the company" and is
    // not treated as "absent" — the form never sends it, so this only affects explicit callers.
    const companySent = values.company_id !== undefined || values.company_name !== undefined || values.client_name !== undefined;
    // A demand's company is fixed at creation — the Edit Demand form keeps Company read-only,
    // and this is the server-side backstop for any direct API call that tries anyway.
    if (
      values.company_id !== undefined &&
      (values.company_id || null) !== (existingDemand.company_id || null)
    ) {
      return NextResponse.json(
        { error: "A demand's client cannot be changed after it is created", code: 'COMPANY_CHANGE_NOT_ALLOWED' },
        { status: 409 }
      );
    }
    let companyFields: {
      company_id: string | null;
      client_name: string | null;
      company_name: string | null;
      company_email: string | null;
    } | null = null;
    if (companySent) {
      // 'update': the Demand may KEEP its own INACTIVE company (recruitment already running
      // against it carries on) but may not be moved onto a different inactive company.
      // `existingDemand.company_id` is what tells the two apart.
      const companyResolution = await resolveDemandCompany(values, 'update', existingDemand.company_id, {
        role: currentUser.role,
        id: currentUser.userId,
      });
      if (isValidationError(companyResolution)) {
        return NextResponse.json({ error: companyResolution.error }, { status: companyResolution.status });
      }
      companyFields = companyResolution.companyId
        ? {
            company_id: companyResolution.companyId,
            client_name: companyResolution.client_name,
            company_name: companyResolution.company_name,
            company_email: companyResolution.company_email,
          }
        : { company_id: null, client_name: null, company_name: null, company_email: null };
      Object.assign(updateData, companyFields);
    }

    // ── Request ID ─────────────────────────────────────────────────────────────────
    // Rule: a Requirement ID is fixed at creation, like the Company - every demand URL and
    // email carries it. Re-sending the same value is ignored, so a legacy ID that breaks
    // today's rules never blocks an edit of the demand's other fields.
    if (values.request_id !== undefined) {
      const nextRequestId = normalizeDemandRequestId(values.request_id ?? '');
      if (nextRequestId !== normalizeDemandRequestId(existingDemand.request_id)) {
        return NextResponse.json(
          {
            error: "A demand's Request ID cannot be changed after it is created",
            code: 'REQUEST_ID_IMMUTABLE',
            field: 'request_id',
          },
          { status: 409 }
        );
      }
    }
    if (values.job_title !== undefined) updateData.job_title = values.job_title?.trim();
    if (values.skill_description !== undefined) updateData.skill_description = values.skill_description?.trim();
    if (values.role_category !== undefined) updateData.role_category = values.role_category;
    if (values.demand_type !== undefined) updateData.demand_type = values.demand_type?.trim() || null;
    if (values.engagement_type !== undefined) updateData.engagement_type = values.engagement_type || null;
    if (values.client_demand_id !== undefined) updateData.client_demand_id = values.client_demand_id?.trim() || null;
    if (values.intermediary_partner !== undefined) updateData.intermediary_partner = values.intermediary_partner?.trim() || null;
    if (values.shift_timings !== undefined) updateData.shift_timings = values.shift_timings?.trim() || null;
    if (values.comments !== undefined) updateData.comments = values.comments?.trim() || null;
    if (values.other_details !== undefined) updateData.other_details = values.other_details?.trim() || null;
    if (values.customer_jd !== undefined) updateData.customer_jd = values.customer_jd?.trim() || null;
    if (values.customer_jd_file_url !== undefined) {
      updateData.customer_jd_file_url = values.customer_jd_file_url || null;
      updateData.customer_jd_file_name = values.customer_jd_file_url ? values.customer_jd_file_name?.trim() || null : null;
    }
    if (nextClientSpocIds !== undefined) updateData.client_spoc_ids = nextClientSpocIds;
    if (values.total_experience !== undefined) updateData.total_experience = values.total_experience?.trim() || null;
    if (values.relevant_experience !== undefined) updateData.relevant_experience = values.relevant_experience?.trim() || null;
    if (values.certifications !== undefined) updateData.certifications = values.certifications;
    if (values.end_client_id !== undefined) updateData.end_client_id = values.end_client_id || null;
    if (sent('experience_levels')) updateData.experience_levels = normalizeSkillsInput(values.experience_levels);
    if (sent('required_skills')) updateData.technology_stack = normalizeSkillsInput(values.required_skills);
    if (values.skills_category_id !== undefined) updateData.skills_category_id = values.skills_category_id;
    if (workModes !== undefined) {
      updateData.work_modes = workModes;
      updateData.work_mode = workModes[0];
    }
    if (values.contact_profile_id !== undefined) updateData.contact_profile_id = values.contact_profile_id;
    if (values.spoc_profile_id !== undefined) updateData.spoc_profile_id = values.spoc_profile_id;
    if (values.num_positions !== undefined) updateData.num_positions = values.num_positions;
    if (values.status !== undefined) updateData.status = values.status;
    if (values.priority !== undefined) updateData.priority = values.priority;
    if (values.compensation_currency_id !== undefined) updateData.compensation_currency_id = values.compensation_currency_id || null;
    if (values.compensation_type_id !== undefined) updateData.compensation_type_id = values.compensation_type_id || null;
    if (values.compensation_min !== undefined) updateData.compensation_min = toCompensationText(values.compensation_min);
    if (values.compensation_max !== undefined) updateData.compensation_max = toCompensationText(values.compensation_max);
    if (sent('locations')) updateData.locations = values.locations ?? [];
    updateData.updated_by = currentUser.userId;

    // `interview_rounds` is only EVER present in the body when the Edit Demand form detected
    // an actual change from what was loaded (see DemandForm's dirty-check against the
    // originally-saved list) — "not sent" always means "leave this demand's rounds alone". An
    // explicit `[]` is a deliberate "clear this demand's own rounds" and is distinct from
    // "field omitted"; zod preserves that distinction (`undefined` vs an empty array).
    const roundsSent = values.interview_rounds !== undefined;
    const roundsNonEmpty = roundsSent && values.interview_rounds!.length > 0;
    const roundsClearedToEmpty = roundsSent && values.interview_rounds!.length === 0;

    // Assignment state BEFORE the write, for the "only notify newly-assigned users" diff
    // (spec §7). Loaded before the transaction so the comparison reflects the committed state.
    const previousAssignment = await loadAssignmentState(id);

    let created: { demand: any; notificationsCreated: number };
    try {
      created = await prisma.$transaction(async (tx) => {
        // A round that already has interviews on THIS demand can be neither deleted nor renamed;
        // adding rounds, toggling Mandatory and reordering are always allowed because none of
        // them stops a row from continuing. Checked INSIDE the transaction so an interview created
        // while the form was open is seen by the same write that would orphan it — the throw
        // aborts the whole save, so no field of this edit is applied either.
        if (roundsSent) {
          const conflicts = await findInUseDemandRoundConflicts(tx, id, values.interview_rounds!);
          if (conflicts.length > 0) {
            throw new InUseRoundError(conflicts);
          }
        }

        const updated = await tx.demands.update({
          where: { id },
          data: updateData,
          include: {
            compensation_currencies: true,
            compensation_types: true,
            end_clients: { select: { name: true } },
            skill_categories: { select: { name: true } },
          },
        });
        if (nextRecruiterIds !== undefined) {
          await tx.demand_ta_allocations.deleteMany({ where: { demand_id: id } });
          await tx.demand_ta_allocations.createMany({
            data: nextRecruiterIds.map((ta_id) => ({ demand_id: id, ta_id })),
          });
        }

        // Change log, in the same transaction as the edit. Only fields this request sent are
        // compared (sentChangeFields), so a partial PUT never logs untouched fields.
        await recordDemandChanges(tx, {
          demandId: id,
          scope: 'demand',
          changes: diffFields(demandChangeSnapshot(existingDemand), pickSent(demandChangeSnapshot(updated), sentChangeFields(values, sent))),
          actorId: currentUser.userId,
        });
        const assignmentEvents = [
          ...(values.contact_profile_id !== undefined
            ? assignmentEventRows({ demandId: id, category: 'account_manager', previousIds: [existingDemand.contact_profile_id], nextIds: [updated.contact_profile_id], actorId: currentUser.userId })
            : []),
          ...(values.spoc_profile_id !== undefined
            ? assignmentEventRows({ demandId: id, category: 'costaff_spoc', previousIds: [existingDemand.spoc_profile_id], nextIds: [updated.spoc_profile_id], actorId: currentUser.userId })
            : []),
          ...(nextRecruiterIds !== undefined
            ? assignmentEventRows({ demandId: id, category: 'recruiter', previousIds: previousAssignment.recruiterIds, nextIds: nextRecruiterIds, actorId: currentUser.userId })
            : []),
          ...(nextClientSpocIds !== undefined
            ? assignmentEventRows({ demandId: id, category: 'client_spoc', previousIds: existingDemand.client_spoc_ids, nextIds: nextClientSpocIds, actorId: currentUser.userId })
            : []),
        ];
        if (assignmentEvents.length > 0) {
          await tx.demand_assignment_events.createMany({ data: assignmentEvents });
        }
        // Interview-round override, saved in the same transaction as the demand so the two can
        // never disagree. Only touched when the caller actually sends rounds; an absent field
        // leaves an existing explicit configuration alone (so editing a demand for an unrelated
        // reason never silently discards its round configuration).
        if (roundsNonEmpty) {
          await tx.demand_interview_config.upsert({
            where: { demand_id: id },
            update: { rounds: values.interview_rounds as any, updated_by: currentUser.userId },
            create: { demand_id: id, rounds: values.interview_rounds as any, updated_by: currentUser.userId },
          });

          // FIRST-TIME SEED ONLY, exactly as on create: this demand's rounds become the
          // company's rounds ONLY if the company has none yet. Editing a demand therefore
          // never modifies the company's rounds — customizing rounds for one requirement
          // must not change what the company's other (and future) demands inherit. Never runs
          // when the list is cleared to empty: an empty save must never touch the company.
          const companyIdForRoundsSeed = companyFields?.company_id ?? existingDemand.company_id;
          if (companyIdForRoundsSeed) {
            await seedCompanyRoundsIfEmpty(tx, companyIdForRoundsSeed, values.interview_rounds!);
          }
        } else if (roundsClearedToEmpty) {
          // Clear only THIS demand's own override — it reverts to inheriting the company's (or
          // the global) rounds at read time. The company's own mapping is never touched here.
          await tx.demand_interview_config.deleteMany({ where: { demand_id: id } });
        }

        // Notify only users NEWLY assigned by this edit. "Next" is read back from the row this
        // transaction just wrote, so an absent field (e.g. an edit that never mentioned
        // recruiters) resolves to the unchanged existing set and yields zero notifications
        // (spec §5/§7 idempotency, §7 "unchanged edit must not duplicate").
        const notificationsCreated = await notifyNewlyAssigned(tx, {
          demandId: id,
          requestId: updated.request_id,
          jobTitle: updated.job_title ?? updated.skill_description,
          previous: previousAssignment,
          next: {
            spocId: updated.spoc_profile_id ?? null,
            recruiterIds: nextRecruiterIds !== undefined ? nextRecruiterIds : previousAssignment.recruiterIds,
          },
          actorId: currentUser.userId,
        });

        return { demand: updated, notificationsCreated };
      });
    } catch (dbError) {
      // A blocked round is a normal, expected outcome of a valid edit, not a server fault: the
      // transaction rolled back whole, so report 409 with the rounds that blocked it and name
      // them, rather than the generic 400 every other failure here produces.
      if (dbError instanceof InUseRoundError) {
        return NextResponse.json(
          {
            error: dbError.message,
            code: 'ROUND_IN_USE',
            rounds: dbError.conflicts.map((r) => ({ name: r.name, interviews: r.interviews })),
          },
          { status: 409 }
        );
      }
      console.error('Error updating demand:', dbError);
      return NextResponse.json({ error: dbError instanceof Error ? dbError.message : 'Failed to update demand' }, { status: 400 });
    }

    const data = created.demand;
    const serialized = serializeDemand(data);

    // Keep the materialized round rows in sync after the demand transaction committed — covers
    // both "replaced with a new non-empty list" and "cleared back to inheriting company/global"
    // (an empty desired list deletes every existing materialized row, see syncMaterializedRounds).
    if (roundsSent) {
      await syncMaterializedRounds(
        data.id,
        roundsNonEmpty ? values.interview_rounds!.map((r) => ({ name: r.name, order: r.order, mandatory: !!r.mandatory, mode: r.mode ?? null })) : []
      ).catch((e) => console.error('Error syncing interview rounds after demand update:', e));
    }

    // Notify the assigned AM/SPOC on update, if their assignment was included in this request
    const notifyProfiles = [amProfile, spocProfile].filter((p): p is NonNullable<typeof p> => !!p?.email);
    for (const profile of notifyProfiles) {
      sendEmail({
        to: profile.email,
        subject: `[Costaff ATS] Mandate Updated: ${data.request_id} — ${data.job_title || data.skill_description}`,
        html: getAmDemandAssignedEmailHtml({
          ...serialized,
          am_name: profile.full_name,
          client_name: data.client_name,
          compensation_currency_symbol: data.compensation_currencies?.symbol,
          compensation_currency_code: data.compensation_currencies?.code,
          compensation_type_name: data.compensation_types?.name,
        })
      }).catch(e => console.error('Error triggering assignee email on update:', e));
    }

    return NextResponse.json({ demand: serialized, notificationsCreated: created.notificationsCreated, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/demands:', error);
    return NextResponse.json({ error: 'Failed to update demand' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await requireRole(DEMAND_WRITE_ROLES);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Demand ID is required' }, { status: 400 });
    }

    const existingDemand = await prisma.demands.findUnique({ where: { id }, select: { created_by: true, contact_profile_id: true, status: true } });
    if (!existingDemand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canDeleteDemand({ role: currentUser.role, id: currentUser.userId }, existingDemand)) {
      return NextResponse.json({ error: DEMAND_DELETE_BLOCKED_MESSAGE }, { status: 403 });
    }

    try {
      await prisma.demands.delete({ where: { id } });
    } catch (dbError) {
      console.error('Error deleting demand:', dbError);
      return NextResponse.json({ error: dbError instanceof Error ? dbError.message : 'Failed to delete demand' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/demands:', error);
    return NextResponse.json({ error: 'Failed to delete demand' }, { status: 500 });
  }
}
