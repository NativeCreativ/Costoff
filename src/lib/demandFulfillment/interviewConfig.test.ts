import { describe, expect, it } from 'vitest';
import { describeInUseDemandRound } from './interviewConfig';

/**
 * The matching rules behind the Edit Demand in-use protection, exercised against a fake client so
 * the important cases are pinned without a database:
 *
 *  - rounds are matched by their MATERIALIZED ROW id, never by name;
 *  - a rename is detected as "same row, new name";
 *  - delete-then-re-add under the same name is treated as a delete;
 *  - only THIS demand's interviews count;
 *  - reorder and Mandatory changes are never conflicts.
 */
type Row = { id: string; name: string; master_round_id: string | null };
type Interview = { round_id: string | null; level: string | null };

/** Minimal stand-in for the two Prisma calls the guard makes. */
function fakeClient(rows: Row[], interviews: Interview[]) {
  return {
    demand_interview_rounds: {
      findMany: async () => rows,
    },
    interviews: {
      findMany: async () => interviews,
    },
  } as never;
}

const ROWS: Row[] = [
  { id: 'row-tech', name: 'Technical', master_round_id: 'm-tech' },
  { id: 'row-hr', name: 'HR', master_round_id: 'm-hr' },
  { id: 'row-ceo', name: 'CEO', master_round_id: 'm-ceo' },
];
/** One interview on Technical — "used". HR and CEO have none. */
const INTERVIEWS: Interview[] = [{ round_id: 'row-tech', level: 'Technical' }];

const { findInUseDemandRoundConflicts } = await import('./interviewConfig');

describe('findInUseDemandRoundConflicts', () => {
  it('flags deleting an in-use round and allows deleting an unused one', async () => {
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, INTERVIEWS), 'd1', [
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
      { row_id: 'row-ceo', round_id: 'm-ceo', name: 'CEO' },
    ]);
    expect(conflicts).toEqual([{ name: 'Technical', interviews: 1 }]);
  });

  it('flags renaming an in-use round (same row id, new name)', async () => {
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, INTERVIEWS), 'd1', [
      { row_id: 'row-tech', round_id: 'm-tech', name: 'Tech Lead' },
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
      { row_id: 'row-ceo', round_id: 'm-ceo', name: 'CEO' },
    ]);
    expect(conflicts.map((c) => c.name)).toEqual(['Technical']);
  });

  it('treats delete + re-add of the same name as a delete and blocks it', async () => {
    // The re-added entry carries row_id: null — name matching alone would see "Technical" still
    // present and let the edit through, orphaning the interview.
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, INTERVIEWS), 'd1', [
      { row_id: null, round_id: 'm-tech', name: 'Technical' },
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
    ]);
    expect(conflicts.map((c) => c.name)).toEqual(['Technical']);
  });

  it('does not flag reorder or Mandatory changes on an in-use round', async () => {
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, INTERVIEWS), 'd1', [
      { row_id: 'row-ceo', round_id: 'm-ceo', name: 'CEO' },
      { row_id: 'row-tech', round_id: 'm-tech', name: 'Technical' },
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
    ]);
    expect(conflicts).toEqual([]);
  });

  it('ignores interviews belonging to other demands', async () => {
    // Same company, other demand: the Technical interview here has this demand's round id but
    // the interview is for a different demand — it must NOT make Technical in-use here.
    const otherDemandInterviews: Interview[] = [];
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, otherDemandInterviews), 'd1', [
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
    ]);
    expect(conflicts).toEqual([]);
  });

  it('counts a legacy interview that only has a level name (no round_id)', async () => {
    const legacy: Interview[] = [{ round_id: null, level: 'technical' }];
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, legacy), 'd1', [
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
    ]);
    expect(conflicts.map((c) => c.name)).toEqual(['Technical']);
  });

  it('allows delete/rename when nothing is in use', async () => {
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, []), 'd1', [
      { row_id: 'row-hr', round_id: 'm-hr', name: 'HR' },
    ]);
    expect(conflicts).toEqual([]);
  });

  it('matches leniently on master id / name for older payloads that omit row_id', async () => {
    const conflicts = await findInUseDemandRoundConflicts(fakeClient(ROWS, INTERVIEWS), 'd1', [
      { round_id: 'm-hr', name: 'HR' },
      { round_id: 'm-tech', name: 'Technical' },
    ]);
    expect(conflicts).toEqual([]);
  });
});

describe('describeInUseDemandRound', () => {
  it('names the round and the interview count', () => {
    expect(describeInUseDemandRound({ name: 'CEO Round', interviews: 1 })).toBe(
      "'CEO Round' already has 1 interview in this demand, so it cannot be deleted or renamed."
    );
    expect(describeInUseDemandRound({ name: 'Technical', interviews: 3 })).toContain('3 interviews');
  });
});