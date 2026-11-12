import { describe, expect, it } from 'vitest';
import { PHASE_STATUS_ARRAYS, phasePercentages, toPhaseCounts } from './reportPhases';
import { PLACED_SUBMISSION_STATUSES } from './readyToJoin';
import { SUBMISSION_STATUS_VALUES } from '@/lib/demandFulfillment/constants';

describe('report phases', () => {
  it('turns SQL bigint counts into numbers and percentages of the row total', () => {
    const counts = toPhaseCounts({ total: BigInt(10), sourcing: BigInt(5), shortlist: 2, selection: '1', onboarding: 2, other: 0 });
    expect(counts).toEqual({ total: 10, sourcing: 5, shortlist: 2, selection: 1, onboarding: 2, other: 0 });
    expect(phasePercentages(counts)).toEqual({ sourcing: 50, shortlist: 20, selection: 10, onboarding: 20, other: 0 });
  });

  it('returns 0% for an empty row instead of dividing by zero', () => {
    expect(phasePercentages(toPhaseCounts({}))).toEqual({ sourcing: 0, shortlist: 0, selection: 0, onboarding: 0, other: 0 });
  });

  it('puts every pipeline status in at most one phase', () => {
    const all = Object.values(PHASE_STATUS_ARRAYS).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const status of all) expect(SUBMISSION_STATUS_VALUES).toContain(status);
  });

  it('only treats real statuses as "placed" for Ready to Join', () => {
    for (const status of PLACED_SUBMISSION_STATUSES) expect(SUBMISSION_STATUS_VALUES).toContain(status);
  });
});
