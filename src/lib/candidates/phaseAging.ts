import { LIFECYCLE_PHASE_STATUSES, type LifecyclePhaseId } from '@/lib/demandFulfillment/lifecyclePhases';

/**
 * Candidate aging per demand phase (review batch 5, Nov 2026). From a pipeline entry's creation
 * time and its status-change events, works out when it entered each phase and how many days it
 * stayed — e.g. sent to the customer on the 1st, shortlisted on the 8th → 7 days in Shortlist.
 *
 * Status changes inside one phase do not restart the clock. Leaving the pipeline (rejected,
 * dropped…) ends the current phase. Days are whole days, rounded down, never negative.
 */

export const PHASE_LABELS: Record<LifecyclePhaseId, string> = {
  sourcing: 'Sourcing',
  shortlist: 'Shortlist',
  selection: 'Selection',
  onboarding: 'Onboarding',
};

export interface PhaseStint {
  phase: LifecyclePhaseId | 'exited';
  entered_at: string;
  left_at: string | null;
  days: number;
}

export interface PhaseAging {
  /** Current phase (null once the candidate left the pipeline). */
  current_phase: LifecyclePhaseId | null;
  /** Days in the current phase so far. */
  days_in_current_phase: number | null;
  /** Total days spent in each phase (summed if a phase was visited twice). */
  days_by_phase: Partial<Record<LifecyclePhaseId, number>>;
  stints: PhaseStint[];
}

export function phaseOfStatus(status: string | null | undefined): LifecyclePhaseId | null {
  if (!status) return null;
  for (const phase of Object.keys(LIFECYCLE_PHASE_STATUSES) as LifecyclePhaseId[]) {
    if ((LIFECYCLE_PHASE_STATUSES[phase] as readonly string[]).includes(status)) return phase;
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

export function computePhaseAging(
  input: {
    created_at: Date | string;
    current_status: string;
    /** status_change events of this pipeline entry, any order. */
    events: { to_status: string | null; created_at: Date | string }[];
  },
  now: Date = new Date()
): PhaseAging {
  const events = input.events
    .filter((e) => !!e.to_status)
    .map((e) => ({ status: e.to_status as string, at: new Date(e.created_at) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const stints: { phase: LifecyclePhaseId | 'exited'; entered: Date; left: Date | null }[] = [];
  // Entries start in Sourcing; if the first event already moves elsewhere, that is fine too.
  stints.push({ phase: 'sourcing', entered: new Date(input.created_at), left: null });
  for (const event of events) {
    const phase = phaseOfStatus(event.status) ?? 'exited';
    const open = stints[stints.length - 1];
    if (open.phase === phase) continue;
    open.left = event.at;
    stints.push({ phase, entered: event.at, left: null });
  }

  // Trust current_status over a missing last event (older data had status changes without events).
  const currentPhase = phaseOfStatus(input.current_status);
  const last = stints[stints.length - 1];
  if ((currentPhase ?? 'exited') !== last.phase) {
    last.left = last.left ?? now;
    stints.push({ phase: currentPhase ?? 'exited', entered: last.left, left: null });
  }

  const daysByPhase: Partial<Record<LifecyclePhaseId, number>> = {};
  const out: PhaseStint[] = stints.map((s) => {
    const days = daysBetween(s.entered, s.left ?? now);
    if (s.phase !== 'exited') daysByPhase[s.phase] = (daysByPhase[s.phase] ?? 0) + days;
    return { phase: s.phase, entered_at: s.entered.toISOString(), left_at: s.left ? s.left.toISOString() : null, days };
  });
  const open = stints[stints.length - 1];
  return {
    current_phase: currentPhase,
    days_in_current_phase: currentPhase ? daysBetween(open.entered, now) : null,
    days_by_phase: daysByPhase,
    stints: out,
  };
}
