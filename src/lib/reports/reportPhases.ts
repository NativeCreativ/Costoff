import { LIFECYCLE_PHASE_STATUSES } from '@/lib/demandFulfillment/lifecyclePhases';

/** Report columns, in pipeline order. "other" = everything not in a phase (rejected, dropped…). */
export const REPORT_PHASES = ['sourcing', 'shortlist', 'selection', 'onboarding', 'other'] as const;
export type ReportPhase = (typeof REPORT_PHASES)[number];

export const REPORT_PHASE_LABELS: Record<ReportPhase, string> = {
  sourcing: 'Sourcing',
  shortlist: 'Shortlist',
  selection: 'Selection',
  onboarding: 'Onboarding',
  other: 'Rejected / Dropped',
};

/** Submission statuses per phase, as plain arrays for SQL `= ANY(...)`. Same source as the demand tabs. */
export const PHASE_STATUS_ARRAYS = {
  sourcing: [...LIFECYCLE_PHASE_STATUSES.sourcing],
  shortlist: [...LIFECYCLE_PHASE_STATUSES.shortlist],
  selection: [...LIFECYCLE_PHASE_STATUSES.selection],
  onboarding: [...LIFECYCLE_PHASE_STATUSES.onboarding],
};

export type PhaseCounts = Record<ReportPhase, number> & { total: number };

/** Share of a row's candidates in each phase, rounded to whole percent; 0 when the row is empty. */
export function phasePercentages(counts: PhaseCounts): Record<ReportPhase, number> {
  const pct = (n: number) => (counts.total > 0 ? Math.round((n / counts.total) * 100) : 0);
  return {
    sourcing: pct(counts.sourcing),
    shortlist: pct(counts.shortlist),
    selection: pct(counts.selection),
    onboarding: pct(counts.onboarding),
    other: pct(counts.other),
  };
}

/** Converts a raw SQL row (counts may come back as bigint) into numbers. */
export function toPhaseCounts(row: Record<string, unknown>): PhaseCounts {
  const n = (key: string) => Number(row[key] ?? 0);
  return {
    sourcing: n('sourcing'),
    shortlist: n('shortlist'),
    selection: n('selection'),
    onboarding: n('onboarding'),
    other: n('other'),
    total: n('total'),
  };
}
