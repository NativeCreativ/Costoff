import { prisma } from '@/lib/db/prisma';
import { INTERVIEW_COMPLETED_STATUS, INTERVIEW_STATUS_OPTIONS, INTERVIEW_STATUS_TRANSITION_OPTIONS } from '@/constants/options';

export interface InterviewStatusRow {
  id: string;
  name: string;
  is_active: boolean;
  is_transition: boolean;
  requires_result: boolean;
  sort_order: number;
}

/** Used when the master table is empty (migration not applied yet) so existing flows keep working. */
function fallbackRows(): InterviewStatusRow[] {
  const transition = new Set(INTERVIEW_STATUS_TRANSITION_OPTIONS.map((o) => o.value));
  return INTERVIEW_STATUS_OPTIONS.map((o, index) => ({
    id: `fallback-${index}`,
    name: o.value,
    is_active: true,
    is_transition: transition.has(o.value),
    requires_result: o.value === INTERVIEW_COMPLETED_STATUS,
    sort_order: index + 1,
  }));
}

export async function loadInterviewStatuses(includeInactive = false): Promise<InterviewStatusRow[]> {
  const rows = await prisma.interview_statuses.findMany({
    where: includeInactive ? undefined : { is_active: true },
    orderBy: { sort_order: 'asc' },
  });
  if (rows.length === 0 && !includeInactive) return fallbackRows();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    is_active: row.is_active,
    is_transition: row.is_transition,
    requires_result: row.requires_result,
    sort_order: row.sort_order,
  }));
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Create accepts any active status. A transition (selection dropdown / bulk move)
 * accepts active rows flagged `is_transition`, plus the interview's current status.
 */
export function interviewStatusError(
  next: string | null | undefined,
  current: string | null | undefined,
  rows: InterviewStatusRow[],
  transition: boolean
): string | null {
  if (next === undefined || next === null || next.trim() === '') return null;
  const active = rows.filter((row) => row.is_active);
  const pool = transition ? active.filter((row) => row.is_transition) : active;
  if (pool.some((row) => sameName(row.name, next))) return null;
  if (current && sameName(current, next)) return null;
  return transition
    ? `"${next.trim()}" is not an active interview status you can move to`
    : `"${next.trim()}" is not an active interview status`;
}

export function statusRequiresResult(status: string | null | undefined, rows: InterviewStatusRow[]): boolean {
  if (!status) return false;
  const match = rows.find((row) => sameName(row.name, status));
  if (match) return match.requires_result;
  return sameName(status, INTERVIEW_COMPLETED_STATUS);
}
