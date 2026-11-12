import { describe, expect, it } from 'vitest';
import { formatWorkModes, resolveWorkModes, toFormWorkModes, demandApiSchema } from '@/components/demands/demand.schema';
import { normalizeTemplateSteps, isOnboardingStepDone } from '@/lib/onboarding/onboardingSteps';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { canManageDemandPipeline, canUploadProfilesToDemand } from '@/lib/auth/demandFulfillmentPermissions';
import { canManageCompanySpocsFromDemand } from '@/lib/auth/companyPermissions';

describe('work modes', () => {
  it('prefers work_modes, keeps canonical order and drops duplicates', () => {
    expect(resolveWorkModes({ work_modes: ['Work On Site', 'Remote', 'Remote'] })).toEqual(['Remote', 'Work On Site']);
  });

  it('accepts the legacy single work_mode', () => {
    expect(resolveWorkModes({ work_mode: 'Hybrid' })).toEqual(['Hybrid']);
    expect(resolveWorkModes({})).toBeUndefined();
  });

  it('opens older demands on their saved mode, or the old default', () => {
    expect(toFormWorkModes({ work_mode: 'Remote', work_modes: [] })).toEqual(['Remote']);
    expect(toFormWorkModes({})).toEqual(['Work On Site']);
    expect(formatWorkModes({ work_modes: ['Remote', 'Hybrid'] })).toBe('Remote, Hybrid');
  });
});

describe('Customer JD file url', () => {
  const base = { job_title: 'x', skill_description: 'y', priority: 'High', status: 'Open', contact_profile_id: 'a' };

  it('accepts only paths the upload route produced', () => {
    expect(demandApiSchema.safeParse({ ...base, customer_jd_file_url: '/uploads/jd/abc/file.pdf' }).success).toBe(true);
    expect(demandApiSchema.safeParse({ ...base, customer_jd_file_url: 'https://evil.example/x.pdf' }).success).toBe(false);
    expect(demandApiSchema.safeParse({ ...base, customer_jd_file_url: '/uploads/jd/../../.env' }).success).toBe(false);
  });
});

describe('onboarding step lists', () => {
  it('trims, rejects blanks and case-insensitive duplicates', () => {
    expect(normalizeTemplateSteps([{ name: '  Offer letter ' }])).toEqual({
      ok: true,
      steps: [{ id: null, name: 'Offer letter', details: null, requires_attachment: false, is_active: true }],
    });
    expect(normalizeTemplateSteps([{ name: ' ' }]).ok).toBe(false);
    expect(normalizeTemplateSteps([{ name: 'PAN' }, { name: 'pan' }]).ok).toBe(false);
  });

  it('counts Completed and Not applicable as done', () => {
    expect(isOnboardingStepDone('completed')).toBe(true);
    expect(isOnboardingStepDone('not_applicable')).toBe(true);
    expect(isOnboardingStepDone('in_progress')).toBe(false);
  });
});

describe('Recruiter (ta) access to demands', () => {
  const demand = { contact_profile_id: 'am1', spoc_profile_id: 'spoc1', created_by: 'am1' };
  const ta = { role: 'ta', id: 'ta1' };

  it('views and uploads to a demand they are not assigned to', () => {
    expect(canViewDemand(ta, { ...demand, recruiterIds: ['ta2'] })).toBe(true);
    expect(canUploadProfilesToDemand(ta, demand, ['ta2'])).toBe(true);
  });

  it('still cannot manage that demand pipeline', () => {
    expect(canManageDemandPipeline(ta, demand, ['ta2'])).toBe(false);
    expect(canManageDemandPipeline(ta, demand, ['ta1'])).toBe(true);
  });

  it('does not widen other roles', () => {
    expect(canUploadProfilesToDemand({ role: 'spoc', id: 'other' }, demand, [])).toBe(false);
    expect(canUploadProfilesToDemand({ role: 'account_manager', id: 'am2' }, demand, [])).toBe(false);
    expect(canViewDemand({ role: 'account_manager', id: 'am2' }, demand)).toBe(false);
  });
});

describe('client SPOCs from the demand form', () => {
  it('lets a Delivery Head use any client and an AM only their own', () => {
    expect(canManageCompanySpocsFromDemand('super_admin', 'u', null)).toBe(true);
    expect(canManageCompanySpocsFromDemand('account_manager', 'am1', 'am1')).toBe(true);
    expect(canManageCompanySpocsFromDemand('account_manager', 'am1', 'am2')).toBe(false);
    expect(canManageCompanySpocsFromDemand('ta', 'ta1', 'ta1')).toBe(false);
  });
});
