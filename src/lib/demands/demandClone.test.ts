import { describe, it, expect } from 'vitest';
import { buildDemandCloneForm } from './demandClone';
import type { Demand } from '@/components/types';

/** Only the fields the clone mapping reads; everything else is irrelevant to it. */
function sourceDemand(overrides: Partial<Demand> = {}): Demand {
  return {
    request_id: 'CSF-2026-0016',
    company_id: '11111111-1111-1111-1111-111111111111',
    job_title: 'Full stack developer',
    skill_description: 'Build features',
    role_category: 'Full Time',
    priority: 'High',
    status: 'Shortlist',
    experience_levels: [],
    technology_stack: ['Node.js', 'SQL'],
    skills_category_id: '22222222-2222-2222-2222-222222222222',
    work_mode: 'Work On Site',
    compensation_currency_id: '',
    compensation_type_id: '',
    compensation_min: '',
    compensation_max: '',
    locations: [],
    num_positions: 5,
    contact_profile_id: '33333333-3333-3333-3333-333333333333',
    spoc_profile_id: '',
    ...overrides,
  } as unknown as Demand;
}

describe('buildDemandCloneForm', () => {
  it('does not carry the source role category over — the clone picks its own', () => {
    const form = buildDemandCloneForm(sourceDemand());
    expect(form.skills_category_id).toBe('');
  });

  it('copies the source skills even with no category saved', () => {
    const form = buildDemandCloneForm(sourceDemand({ skills_category_id: null }));
    expect(form.required_skills).toEqual(['Node.js', 'SQL']);
    expect(form.skills_category_id).toBe('');
  });

  it('still generates a fresh Request ID instead of reusing the source one', () => {
    expect(buildDemandCloneForm(sourceDemand()).request_id).toBe('');
  });
});