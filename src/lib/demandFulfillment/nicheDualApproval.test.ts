import { describe, expect, it } from 'vitest';
import {
  canSpocReviewProfile,
  canAmReviewProfile,
  canToggleSourcingType,
} from '@/lib/auth/demandFulfillmentPermissions';
import { checkSubmissionStatusTransition } from '@/lib/demandFulfillment/statusTransitions';
import { SUBMISSION_FORWARD_ORDER } from '@/lib/demandFulfillment/constants';

const demand = {
  created_by: 'am1',
  contact_profile_id: 'am1',
  spoc_profile_id: 'spoc1',
};
const recruiterIds = ['ta1', 'ta2'];

describe('Niche Demand Dual Approval permissions (Review Comment 21)', () => {
  it('Step 1 (SPOC approval): Only assigned SPOC or Super Admin can approve/reject', () => {
    expect(canSpocReviewProfile({ role: 'spoc', id: 'spoc1' }, demand)).toBe(true);
    expect(canSpocReviewProfile({ role: 'super_admin', id: 'admin1' }, demand)).toBe(true);
    // AM or Recruiters cannot approve SPOC stage
    expect(canSpocReviewProfile({ role: 'account_manager', id: 'am1' }, demand)).toBe(false);
    expect(canSpocReviewProfile({ role: 'ta', id: 'ta1' }, demand)).toBe(false);
    // Different SPOC cannot approve
    expect(canSpocReviewProfile({ role: 'spoc', id: 'other_spoc' }, demand)).toBe(false);
  });

  it('Step 2 (AM approval): Only current AM or Super Admin can give final approval', () => {
    expect(canAmReviewProfile({ role: 'account_manager', id: 'am1' }, demand)).toBe(true);
    expect(canAmReviewProfile({ role: 'super_admin', id: 'admin1' }, demand)).toBe(true);
    // SPOC or Recruiters cannot give final AM approval
    expect(canAmReviewProfile({ role: 'spoc', id: 'spoc1' }, demand)).toBe(false);
    expect(canAmReviewProfile({ role: 'ta', id: 'ta1' }, demand)).toBe(false);
    // Different AM cannot approve
    expect(canAmReviewProfile({ role: 'account_manager', id: 'other_am' }, demand)).toBe(false);
  });
});

describe('Sourcing Type Toggle permissions (Review Comment 15)', () => {
  it('allows Super Admin, current AM, assigned SPOC, and assigned or creator TA to toggle active/backup', () => {
    // Super admin
    expect(canToggleSourcingType({ role: 'super_admin', id: 'sa' }, demand, recruiterIds, null)).toBe(true);
    // Current AM
    expect(canToggleSourcingType({ role: 'account_manager', id: 'am1' }, demand, recruiterIds, null)).toBe(true);
    // Other AM
    expect(canToggleSourcingType({ role: 'account_manager', id: 'am2' }, demand, recruiterIds, null)).toBe(false);
    // Assigned SPOC
    expect(canToggleSourcingType({ role: 'spoc', id: 'spoc1' }, demand, recruiterIds, null)).toBe(true);
    // Other SPOC
    expect(canToggleSourcingType({ role: 'spoc', id: 'spoc2' }, demand, recruiterIds, null)).toBe(false);
    // Allocated TA
    expect(canToggleSourcingType({ role: 'ta', id: 'ta1' }, demand, recruiterIds, null)).toBe(true);
    // Unallocated TA who uploaded the profile
    expect(canToggleSourcingType({ role: 'ta', id: 'ta_uploader' }, demand, recruiterIds, { added_by: 'ta_uploader' })).toBe(true);
    // Unallocated TA who did NOT upload
    expect(canToggleSourcingType({ role: 'ta', id: 'ta_other' }, demand, recruiterIds, { added_by: 'ta_uploader' })).toBe(false);
  });
});

describe('Submission status transitions with submitted_to_am', () => {
  it('includes submitted_to_am between submitted_to_spoc and shortlisted_internal in forward order', () => {
    const spocIdx = SUBMISSION_FORWARD_ORDER.indexOf('submitted_to_spoc');
    const amIdx = SUBMISSION_FORWARD_ORDER.indexOf('submitted_to_am');
    const shortlistIdx = SUBMISSION_FORWARD_ORDER.indexOf('shortlisted_internal');

    expect(spocIdx).toBeGreaterThan(-1);
    expect(amIdx).toBeGreaterThan(spocIdx);
    expect(shortlistIdx).toBeGreaterThan(amIdx);
  });

  it('allows forward movement from submitted_to_spoc -> submitted_to_am without remark', () => {
    const result = checkSubmissionStatusTransition('submitted_to_spoc', 'submitted_to_am', null);
    expect(result.allowed).toBe(true);
    expect(result.isReversal).toBe(false);
    expect(result.requiresRemark).toBe(false);
  });

  it('allows forward movement from submitted_to_am -> shortlisted_internal without remark', () => {
    const result = checkSubmissionStatusTransition('submitted_to_am', 'shortlisted_internal', null);
    expect(result.allowed).toBe(true);
    expect(result.isReversal).toBe(false);
    expect(result.requiresRemark).toBe(false);
  });

  it('treats rejection from submitted_to_am -> sourced as a reversal requiring remark', () => {
    const withoutRemark = checkSubmissionStatusTransition('submitted_to_am', 'sourced', null);
    expect(withoutRemark.allowed).toBe(false);
    expect(withoutRemark.requiresRemark).toBe(true);
    expect(withoutRemark.isReversal).toBe(true);

    const withRemark = checkSubmissionStatusTransition('submitted_to_am', 'sourced', 'Skills test failed');
    expect(withRemark.allowed).toBe(true);
    expect(withRemark.isReversal).toBe(true);
  });
});
