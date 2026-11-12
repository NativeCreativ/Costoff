/** Maps a filter query-param name to its database column, per module (used by buildExactMatchWhere). */
export const USER_FILTER_FIELDS = {
  role: 'role',
  status: 'status',
} as const;

/** Same, but for buildRawExactMatchWhere (raw SQL). */
export const DEMAND_FILTER_FIELDS = {
  status: 'status',
  priority: 'priority',
  roleType: 'role_category',
} as const;

/** Used by buildExactMatchWhere (Prisma query builder, same as User Management's route). */
export const CANDIDATE_FILTER_FIELDS = {
  source: 'source',
  workMode: 'work_mode',
} as const;

/** Used by buildExactMatchWhere (Prisma query builder, same as User Management's route). */
export const INTERVIEW_FILTER_FIELDS = {
  mode: 'mode',
  status: 'status',
  result: 'result',
  round: 'level', // matches by round name (denormalized), not round_id — see interviewConfig notes
} as const;
