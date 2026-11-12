import { describe, expect, it } from 'vitest';
import { getInterviewRowActions, normalizeInterviewResult } from './interviewPermissions';

/**
 * Covers the status-based Edit/Delete lock rule (see interviewPermissions.ts's
 * statusActionRule, exercised here through the public getInterviewRowActions):
 *
 *   Scheduled / Client No-Show / Candidate No-Show -> Edit + Delete allowed
 *   Completed                                      -> Edit + Delete blocked
 *
 * ...regardless of `result` (Pass / Fail / On Hold / none), and independent of any other
 * interview round — getInterviewRowActions is a pure function of the one row passed in, so
 * "independent per round" falls directly out of that (see the last describe block, which
 * calls it twice with different statuses to make that explicit).
 *
 * Role/ownership authorization (the OTHER half of the decision) is unchanged by this task —
 * covered here only to the extent needed to prove the two axes combine with AND, not that the
 * role rules themselves are correct (that's demandFulfillmentPermissions'/canEditInterview's
 * own concern).
 */

const OPEN_STATUSES = ['Scheduled', 'Client No-Show', 'Candidate No-Show'] as const;
const RESULTS = [undefined, null, 'pass', 'fail', 'on_hold', 'on hold', ''] as const;
const AUTHORIZED_ACCESS = { role: 'super_admin' as const };

describe('getInterviewRowActions — status-based lock, authorized actor', () => {
  it.each(OPEN_STATUSES)('status=%s: Edit and Delete are both allowed, for every result', (status) => {
    for (const result of RESULTS) {
      const actions = getInterviewRowActions({ status, result } as any, AUTHORIZED_ACCESS);
      expect(actions.canEdit, `canEdit for status=${status} result=${result}`).toBe(true);
      expect(actions.canDelete, `canDelete for status=${status} result=${result}`).toBe(true);
      expect(actions.editBlockedReason).toBeNull();
      expect(actions.deleteBlockedReason).toBeNull();
    }
  });

  it('status=Completed: Edit and Delete are both blocked, for every result', () => {
    for (const result of RESULTS) {
      const actions = getInterviewRowActions({ status: 'Completed', result } as any, AUTHORIZED_ACCESS);
      expect(actions.canEdit, `canEdit for result=${result}`).toBe(false);
      expect(actions.canDelete, `canDelete for result=${result}`).toBe(false);
      expect(actions.editBlockedReason).toMatch(/completed/i);
      expect(actions.deleteBlockedReason).toMatch(/completed/i);
    }
  });

  it('an unrecognized/missing status is treated as open (not locked) — only the literal "Completed" locks', () => {
    for (const status of [undefined, null, '', 'Rescheduled', 'Cancelled', 'something-unexpected']) {
      const actions = getInterviewRowActions({ status } as any, AUTHORIZED_ACCESS);
      expect(actions.canEdit, `canEdit for status=${status}`).toBe(true);
      expect(actions.canDelete, `canDelete for status=${status}`).toBe(true);
    }
  });
});

describe('getInterviewRowActions — role/ownership gate combines with the status rule via AND', () => {
  it('an unauthorized role is blocked regardless of status', () => {
    const unauthorizedAccess = { role: 'spoc' }; // not in INTERVIEW_WRITE_ROLES
    for (const status of [...OPEN_STATUSES, 'Completed']) {
      const actions = getInterviewRowActions({ status } as any, unauthorizedAccess);
      expect(actions.canEdit, `canEdit for status=${status}`).toBe(false);
      expect(actions.canDelete, `canDelete for status=${status}`).toBe(false);
      expect(actions.editBlockedReason).toBeTruthy();
      expect(actions.deleteBlockedReason).toBeTruthy();
    }
  });

  it('canManage=false (e.g. a recruiter who did not create this interview) blocks regardless of status, and surfaces the server-supplied reason', () => {
    const blockedAccess = { role: 'ta', canManage: false, blockedReason: 'You cannot manage this interview — it was scheduled by someone else.' };
    for (const status of [...OPEN_STATUSES, 'Completed']) {
      const actions = getInterviewRowActions({ status } as any, blockedAccess);
      expect(actions.canEdit).toBe(false);
      expect(actions.canDelete).toBe(false);
      expect(actions.editBlockedReason).toBe(blockedAccess.blockedReason);
      expect(actions.deleteBlockedReason).toBe(blockedAccess.blockedReason);
    }
  });

  it('an authorized role (canManage=true, e.g. the recruiter who created it) on an OPEN status is fully allowed', () => {
    const authorizedAccess = { role: 'ta', canManage: true };
    const actions = getInterviewRowActions({ status: 'Scheduled' } as any, authorizedAccess);
    expect(actions.canEdit).toBe(true);
    expect(actions.canDelete).toBe(true);
  });

  it('an authorized role is still blocked on Completed — role authorization alone is not enough', () => {
    const authorizedAccess = { role: 'super_admin', canManage: true };
    const actions = getInterviewRowActions({ status: 'Completed' } as any, authorizedAccess);
    expect(actions.canEdit).toBe(false);
    expect(actions.canDelete).toBe(false);
  });
});

describe('getInterviewRowActions — multiple rounds are evaluated independently', () => {
  it('two interview rows for the same candidate with different statuses get independent decisions', () => {
    const l1Completed = getInterviewRowActions({ status: 'Completed' } as any, AUTHORIZED_ACCESS);
    const l2Scheduled = getInterviewRowActions({ status: 'Scheduled' } as any, AUTHORIZED_ACCESS);

    expect(l1Completed.canEdit).toBe(false);
    expect(l1Completed.canDelete).toBe(false);
    expect(l2Scheduled.canEdit).toBe(true);
    expect(l2Scheduled.canDelete).toBe(true);
  });

  it("a Completed round's lock has no bearing on a Candidate No-Show round for the same candidate", () => {
    const finalCompleted = getInterviewRowActions({ status: 'Completed', result: 'pass' } as any, AUTHORIZED_ACCESS);
    const l1NoShow = getInterviewRowActions({ status: 'Candidate No-Show' } as any, AUTHORIZED_ACCESS);

    expect(finalCompleted.canEdit).toBe(false);
    expect(l1NoShow.canEdit).toBe(true);
    expect(l1NoShow.canDelete).toBe(true);
  });
});

describe('normalizeInterviewResult — unaffected by the lock-rule change (still used for display)', () => {
  it.each([
    ['pass', 'pass'],
    ['Pass', 'pass'],
    ['fail', 'fail'],
    ['on_hold', 'on_hold'],
    ['on hold', 'on_hold'],
    ['', null],
    [null, null],
    [undefined, null],
    ['garbage', null],
  ] as const)('normalizeInterviewResult(%s) -> %s', (input, expected) => {
    expect(normalizeInterviewResult(input as any)).toBe(expected);
  });
});
