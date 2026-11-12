/** Columns the "search" query param matches against, per module (used by buildSearchWhere). */
export const USER_SEARCH_FIELDS = ['first_name', 'last_name', 'full_name', 'email', 'phone'] as const;

/** Same, but for buildRawIlikeWhere (raw SQL); text vs array columns need different SQL. */
export const DEMAND_SEARCH_TEXT_FIELDS = [
  'request_id',
  'job_title',
  'skill_description',
  'client_name',
  'company_name',
  'company_email',
  'am_name',
] as const;

export const DEMAND_SEARCH_ARRAY_FIELDS = ['technology_stack', 'recruiter_names'] as const;

/** Plain-text columns; buildSearchWhere handles these via Prisma's query builder (used by /api/candidates). */
export const CANDIDATE_SEARCH_FIELDS = [
  'full_name',
  'email',
  'phone',
  'current_company',
  'current_designation',
  'current_location',
] as const;

/** Array column (skills); matched via buildRawIlikeWhere since Prisma's query builder can't do substring search on String[]. */
export const CANDIDATE_SEARCH_ARRAY_FIELDS = ['skills'] as const;
