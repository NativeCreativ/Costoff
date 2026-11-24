import { describe, expect, it } from 'vitest';
import {
  canUnlockRound,
  validateInterviewRecord,
  shouldCascadeRejection,
} from './interviewManagerRules';

describe('Interview Manager Sequence & Validation Rules (Review Comments 13 & 14)', () => {
  describe('canUnlockRound — top-down sequence logic', () => {
    it('Round 1 is always unlocked regardless of previous rounds', () => {
      expect(canUnlockRound(1, null)).toBe(true);
      expect(canUnlockRound(1, undefined)).toBe(true);
    });

    it('Round 2 is locked if Round 1 is missing, scheduled, or feedback awaiting', () => {
      expect(canUnlockRound(2, null)).toBe(false);
      expect(canUnlockRound(2, { status: 'Scheduled' })).toBe(false);
      expect(canUnlockRound(2, { status: 'Completed', result: 'Feedback Awaiting' })).toBe(false);
      expect(canUnlockRound(2, { status: 'Completed', result: 'Onhold' })).toBe(false);
      expect(canUnlockRound(2, { status: 'Completed', result: 'Rejected' })).toBe(false);
    });

    it('Round 2 is unlocked when Round 1 is Completed with Result "Selected"', () => {
      expect(canUnlockRound(2, { status: 'Completed', result: 'Selected' })).toBe(true);
    });

    it('Round 3 is unlocked only when Round 2 is Completed with Result "Selected"', () => {
      expect(canUnlockRound(3, { status: 'Completed', result: 'Selected' })).toBe(true);
      expect(canUnlockRound(3, { status: 'Completed', result: 'Onhold' })).toBe(false);
    });
  });

  describe('validateInterviewRecord — mandatory field requirements', () => {
    it('requires Reason when status is Rescheduled', () => {
      const res = validateInterviewRecord({ status: 'Rescheduled' });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Reason is required/i);
    });

    it('requires Reason when status is Cancelled', () => {
      const res = validateInterviewRecord({ status: 'Cancelled' });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Reason is required/i);
    });

    it('requires custom_reason when reason is "Others"', () => {
      const resNoCustom = validateInterviewRecord({
        status: 'Cancelled',
        reason: 'Others',
      });
      expect(resNoCustom.valid).toBe(false);
      expect(resNoCustom.error).toMatch(/custom reason/i);

      const resWithCustom = validateInterviewRecord({
        status: 'Cancelled',
        reason: 'Others',
        custom_reason: 'Emergency client schedule change',
      });
      expect(resWithCustom.valid).toBe(true);
    });

    it('passes for standard cancellation reason', () => {
      const res = validateInterviewRecord({
        status: 'Rescheduled',
        reason: 'Candidate_Not_Available',
      });
      expect(res.valid).toBe(true);
    });

    it('requires Reject Reason when status is Completed and Result is Rejected', () => {
      const resNoReason = validateInterviewRecord({
        status: 'Completed',
        result: 'Rejected',
      });
      expect(resNoReason.valid).toBe(false);
      expect(resNoReason.error).toMatch(/Reject reason is mandatory/i);

      const resWithReason = validateInterviewRecord({
        status: 'Completed',
        result: 'Rejected',
        reject_reason: 'Lacked hands-on experience in distributed systems',
      });
      expect(resWithReason.valid).toBe(true);
    });

    it('passes for Completed with Selected without reject_reason', () => {
      const res = validateInterviewRecord({
        status: 'Completed',
        result: 'Selected',
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('shouldCascadeRejection', () => {
    it('returns true when result is Rejected', () => {
      expect(shouldCascadeRejection('Rejected')).toBe(true);
    });

    it('returns false for other results', () => {
      expect(shouldCascadeRejection('Selected')).toBe(false);
      expect(shouldCascadeRejection('Feedback Awaiting')).toBe(false);
      expect(shouldCascadeRejection('Onhold')).toBe(false);
      expect(shouldCascadeRejection(null)).toBe(false);
    });
  });
});
