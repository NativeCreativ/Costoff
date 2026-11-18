import { describe, expect, it } from 'vitest';
import { callLogSchema, demandInstructionSchema } from '@/components/demandFulfillment/callLog.schema';
import { canLogDemandCall, canManageDemandInstruction, canWriteDemandInstructions } from '@/lib/auth/demandFulfillmentPermissions';

const CANDIDATE_ID = '11111111-1111-4111-8111-111111111111';
const newCandidate = {
  full_name: 'Asha Rao',
  phone: '+91 98765 43210',
  email: '',
  current_company: '',
  current_location: '',
  total_experience: '',
  availability: 'Immediate',
  expected_ctc: '',
  source: 'naukri',
};

describe('call log schema', () => {
  it('needs exactly one of an existing or a new candidate', () => {
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, outcome: 'demand_match' }).success).toBe(true);
    expect(callLogSchema.safeParse({ new_candidate: newCandidate, outcome: 'demand_match' }).success).toBe(true);
    expect(callLogSchema.safeParse({ outcome: 'demand_match' }).success).toBe(false);
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, new_candidate: newCandidate, outcome: 'demand_match' }).success).toBe(false);
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, outcome: 'fit' }).success).toBe(false);
  });

  it('needs a fail reason on a not-fit call, and real text for "Other"', () => {
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, outcome: 'not_fit' }).success).toBe(false);
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, outcome: 'not_fit', fail_reason: 'Other' }).success).toBe(false);
    expect(callLogSchema.safeParse({ candidate_id: CANDIDATE_ID, outcome: 'not_fit', fail_reason: 'Notice period too long' }).success).toBe(true);
  });

  it('only asks a new candidate for name and a valid phone', () => {
    expect(callLogSchema.safeParse({ new_candidate: { ...newCandidate, phone: 'abc' }, outcome: 'demand_match' }).success).toBe(false);
    expect(callLogSchema.safeParse({ new_candidate: { ...newCandidate, full_name: '' }, outcome: 'demand_match' }).success).toBe(false);
  });
});

describe('instruction schema', () => {
  it('needs text, a date and a known source', () => {
    expect(demandInstructionSchema.safeParse({ source: 'meeting', instruction_date: '2026-11-13', content: 'Prefer immediate joiners' }).success).toBe(true);
    expect(demandInstructionSchema.safeParse({ source: 'meeting', instruction_date: '2026-11-13', content: '  ' }).success).toBe(false);
    expect(demandInstructionSchema.safeParse({ source: 'fax', instruction_date: '2026-11-13', content: 'x' }).success).toBe(false);
  });
});

describe('call log and instruction permissions', () => {
  const demand = { contact_profile_id: 'am1', spoc_profile_id: 'sp1', created_by: 'am1' };

  it('any recruiter may log calls (it is sourcing); viewers may not', () => {
    expect(canLogDemandCall({ role: 'ta', id: 'ta9' }, demand, ['ta1'])).toBe(true);
    expect(canLogDemandCall({ role: 'account_manager', id: 'am1' }, demand, [])).toBe(true);
    expect(canLogDemandCall({ role: 'account_manager', id: 'am2' }, demand, [])).toBe(false);
    expect(canLogDemandCall({ role: 'viewer', id: 'v' }, demand, [])).toBe(false);
  });

  it('instructions are written by the AM, the SPOC or the Delivery Head of the demand', () => {
    expect(canWriteDemandInstructions({ role: 'account_manager', id: 'am1' }, demand)).toBe(true);
    expect(canWriteDemandInstructions({ role: 'spoc', id: 'sp1' }, demand)).toBe(true);
    expect(canWriteDemandInstructions({ role: 'spoc', id: 'sp2' }, demand)).toBe(false);
    expect(canWriteDemandInstructions({ role: 'ta', id: 'ta1' }, demand)).toBe(false);
  });

  it('only the author (still on the demand) or the Delivery Head edits an instruction', () => {
    expect(canManageDemandInstruction({ role: 'spoc', id: 'sp1' }, demand, { created_by: 'sp1' })).toBe(true);
    expect(canManageDemandInstruction({ role: 'account_manager', id: 'am1' }, demand, { created_by: 'sp1' })).toBe(false);
    expect(canManageDemandInstruction({ role: 'super_admin', id: 'dh' }, demand, { created_by: 'sp1' })).toBe(true);
  });
});
