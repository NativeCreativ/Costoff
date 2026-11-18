/**
 * Role constants and coarse role predicates for Candidate and Interview CRUD.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM candidatePermissions.ts / interviewPermissions.ts:
 * those two modules decide row-level access and therefore import `prisma`, which cannot be
 * pulled into a browser bundle. Before this module, the client had to re-state these role
 * arrays inline (e.g. `['super_admin','ta','account_manager'].includes(role)` in
 * app/(app)/candidates/page.tsx), so a change here would silently desync the UI from the API.
 * These constants are the single definition; the server modules import and re-export them, and
 * client components import them directly. One source of truth, no duplication.
 *
 * This module is intentionally PURE — no prisma, no server-only imports.
 *
 * The distinction the whole RBAC model rests on:
 *
 *   WHO CAN SEE a record  !=  WHO CAN CHANGE a record
 *
 * Recruiters can see EVERY candidate and EVERY interview (so they can search the pool and look
 * up a profile), but may only mutate a record they own or one on a Demand they are assigned to.
 * Those two questions are answered by different functions in different modules and must never be
 * collapsed into one.
 */

/* ─────────────────────────── Candidates ─────────────────────────── */

/**
 * Roles that may read EVERY candidate, system-wide.
 *
 * `ta` (Recruiter) is here by design: recruiters work from the shared candidate pool and must
 * be able to see a profile another recruiter sourced. Mutation is scoped separately — see
 * canEditCandidateDemand, which still requires demand assignment AND creator ownership.
 *
 * `account_manager` is NOT here: an AM reads candidates only within the Demands they own, per
 * the RBAC spec, even though Demand visibility itself is unchanged for them.
 */
export const CANDIDATE_READ_ALL_ROLES = ['super_admin', 'hr', 'viewer', 'ta'];

/**
 * Roles that may read every candidate **of a given Demand**, for the demand-level checks.
 *
 * Deliberately narrower than CANDIDATE_READ_ALL_ROLES: this is the gate that decides whether a
 * recruiter may CREATE in / EDIT a demand's pipeline, so `ta` must NOT be admitted here even
 * though it may read every candidate. Keeping the two sets separate is what stops "recruiters
 * can see all candidates" from silently becoming "recruiters can edit all candidates".
 */
export const CANDIDATE_DEMAND_VIEW_ALL_ROLES = ['super_admin', 'hr', 'viewer'];

/** Roles that may ever create/update/delete a candidate (subject to Demand-scope match). */
export const CANDIDATE_WRITE_ROLES = ['super_admin', 'ta', 'account_manager'];

/**
 * Roles allowed to create a candidate in the GLOBAL master pool (no demand context).
 *
 * Client decision (Nov 2026): Recruiters and Account Managers may add candidates to the database
 * without a demand, using the same Add Candidate form. A Recruiter reads every candidate anyway;
 * an AM additionally reads and edits the candidates they added themselves (candidate.added_by,
 * see canAccessCandidate / buildCandidateScopeFilter), so their own pool entries never vanish.
 */
export const MASTER_POOL_CREATE_ROLES = ['super_admin', 'ta', 'account_manager'];

/* ─────────────────────────── Interviews ─────────────────────────── */

// Rule: ta is scoped to interviews they created, not read-all.
export const INTERVIEW_READ_ALL_ROLES = ['super_admin', 'hr', 'viewer'];

/** Roles that may ever create/edit/delete an interview (subject to Demand-scope match). */
export const INTERVIEW_WRITE_ROLES = ['super_admin', 'account_manager', 'ta'];

/**
 * Roles that may create an interview from the DIRECT /interviews module.
 *
 * `ta` and `account_manager` are included alongside super_admin: POST /api/interviews still
 * requires a `demand_id` and separately re-checks canManageInterview (-> canManageDemandPipeline)
 * against THAT demand, so a recruiter/AM using this direct module can never schedule for a
 * candidate/demand outside their own scope — this constant only controls whether the module's
 * entry point is reachable at all, not which demands it can target.
 */
export const INTERVIEW_DIRECT_CREATE_ROLES = ['super_admin', 'ta', 'account_manager'];

/* ─────────────────────── Client-safe predicates ─────────────────────── */
/*
 * Thin role-only wrappers for client components, so the UI asks the same question the API asks
 * instead of re-deriving it. They deliberately cover ONLY role-level capability: whether a
 * specific record can be changed additionally depends on Demand assignment and creator
 * ownership, which only the server can resolve. The server returns those as `can_edit` /
 * `can_manage` on each row, and the UI combines the two.
 */

/** May this role create a candidate in the global master pool? */
export function canCreateCandidateInMasterPool(role?: string | null): boolean {
  return !!role && (MASTER_POOL_CREATE_ROLES as readonly string[]).includes(role);
}

/** May this role ever create/update/delete a candidate at all? (Demand scope checked server-side.) */
export function canWriteCandidates(role?: string | null): boolean {
  return !!role && (CANDIDATE_WRITE_ROLES as readonly string[]).includes(role);
}

/** May this role ever create/edit/delete an interview at all? (Demand scope checked server-side.) */
export function canWriteInterviews(role?: string | null): boolean {
  return !!role && (INTERVIEW_WRITE_ROLES as readonly string[]).includes(role);
}

/** May this role create an interview from the direct /interviews screen? */
export function canScheduleInterviewFromModule(role?: string | null): boolean {
  return !!role && (INTERVIEW_DIRECT_CREATE_ROLES as readonly string[]).includes(role);
}