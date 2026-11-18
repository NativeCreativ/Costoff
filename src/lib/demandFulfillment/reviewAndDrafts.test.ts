import { describe, expect, it } from 'vitest';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canReviewSourcedProfile, canSubmitSourcedProfile } from '@/lib/auth/demandFulfillmentPermissions';
import { sourcingReviewSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { callLogUpdateSchema } from '@/components/demandFulfillment/callLog.schema';

const demand = { created_by: 'am1', contact_profile_id: 'am1', spoc_profile_id: 'spoc1' };

describe('draft demands', () => {
  const draft = { ...demand, is_draft: true, recruiterIds: ['ta1'] };
  it('are visible to their creator and Super Admin only', () => {
    expect(canViewDemand({ role: 'account_manager', id: 'am1' }, draft)).toBe(true);
    expect(canViewDemand({ role: 'super_admin', id: 'dh' }, draft)).toBe(true);
    expect(canViewDemand({ role: 'ta', id: 'ta1' }, draft)).toBe(false);
    expect(canViewDemand({ role: 'spoc', id: 'spoc1' }, draft)).toBe(false);
  });
  it('become normal once submitted', () => {
    expect(canViewDemand({ role: 'ta', id: 'ta1' }, { ...draft, is_draft: false })).toBe(true);
  });
});

describe('sourcing review', () => {
  it('lets the AM, the SPOC and Super Admin approve / reject — not recruiters', () => {
    expect(canReviewSourcedProfile({ role: 'account_manager', id: 'am1' }, demand)).toBe(true);
    expect(canReviewSourcedProfile({ role: 'spoc', id: 'spoc1' }, demand)).toBe(true);
    expect(canReviewSourcedProfile({ role: 'super_admin', id: 'dh' }, demand)).toBe(true);
    expect(canReviewSourcedProfile({ role: 'ta', id: 'ta1' }, demand)).toBe(false);
    expect(canReviewSourcedProfile({ role: 'account_manager', id: 'other' }, demand)).toBe(false);
  });
  it('lets the assigned team or the uploader submit', () => {
    expect(canSubmitSourcedProfile({ role: 'ta', id: 'ta1' }, demand, ['ta1'], { added_by: null })).toBe(true);
    expect(canSubmitSourcedProfile({ role: 'ta', id: 'ta9' }, demand, ['ta1'], { added_by: 'ta9' })).toBe(true);
    expect(canSubmitSourcedProfile({ role: 'ta', id: 'ta9' }, demand, ['ta1'], { added_by: 'ta1' })).toBe(false);
  });
  it('needs a reason to reject', () => {
    expect(sourcingReviewSchema.safeParse({ action: 'reject' }).success).toBe(false);
    expect(sourcingReviewSchema.safeParse({ action: 'reject', remark: 'CTC too high' }).success).toBe(true);
    expect(sourcingReviewSchema.safeParse({ action: 'approve' }).success).toBe(true);
  });
});

describe('call log edit', () => {
  it('keeps the fail-reason rule', () => {
    expect(callLogUpdateSchema.safeParse({ outcome: 'not_fit' }).success).toBe(false);
    expect(callLogUpdateSchema.safeParse({ outcome: 'not_fit', fail_reason: 'Skills mismatch' }).success).toBe(true);
    expect(callLogUpdateSchema.safeParse({ outcome: 'demand_match', notes: 'Good fit' }).success).toBe(true);
  });
});
