import { describe, expect, it } from 'vitest';
import { buildInterviewReadScope, canViewInterview } from './interviewPermissions';
import { INTERVIEW_READ_ALL_ROLES } from './recordPermissions';

// Test fixtures for roles
const superAdmin = { role: 'super_admin', id: 'admin-1111' };
const deliveryHead = { role: 'super_admin', id: 'dh-1111' };
const taUser = { role: 'ta', id: 'ta-2222' };
const otherTaUser = { role: 'ta', id: 'ta-3333' };
const amUser = { role: 'account_manager', id: 'am-4444' };
const otherAmUser = { role: 'account_manager', id: 'am-5555' };
const spocUser = { role: 'spoc', id: 'spoc-6666' };
const hrUser = { role: 'hr', id: 'hr-7777' };
const viewerUser = { role: 'viewer', id: 'viewer-8888' };

describe('Interview Visibility Policy (buildInterviewReadScope & canViewInterview)', () => {
  it('Super Admin and Delivery Head see all interviews', () => {
    expect(buildInterviewReadScope(superAdmin)).toEqual({});
    expect(buildInterviewReadScope(deliveryHead)).toEqual({});
    expect(INTERVIEW_READ_ALL_ROLES).toContain('super_admin');

    const sample = { created_by: 'someone-else', demands: { contact_profile_id: 'other-am' } };
    expect(canViewInterview(superAdmin, sample)).toBe(true);
    expect(canViewInterview(deliveryHead, sample)).toBe(true);
  });

  it('TA sees only interviews created by that TA', () => {
    const scope = buildInterviewReadScope(taUser);
    expect(scope).toEqual({ created_by: taUser.id });

    const ownInterview = { created_by: taUser.id, demands: { contact_profile_id: 'other-am' } };
    const otherInterview = { created_by: otherTaUser.id, demands: { contact_profile_id: 'other-am' } };
    expect(canViewInterview(taUser, ownInterview)).toBe(true);
    expect(canViewInterview(taUser, otherInterview)).toBe(false);
  });

  it('AM sees only interviews for demands where that user is the AM', () => {
    const scope = buildInterviewReadScope(amUser);
    expect(scope).toEqual({ demands: { contact_profile_id: amUser.id } });

    const ownDemandInterview = { created_by: otherTaUser.id, demands: { contact_profile_id: amUser.id } };
    const otherDemandInterview = { created_by: otherTaUser.id, demands: { contact_profile_id: otherAmUser.id } };
    expect(canViewInterview(amUser, ownDemandInterview)).toBe(true);
    expect(canViewInterview(amUser, otherDemandInterview)).toBe(false);
  });

  it('SPOC, HR, and Viewer keep their visibility', () => {
    expect(buildInterviewReadScope(spocUser)).toEqual({ demands: { spoc_profile_id: spocUser.id } });
    expect(buildInterviewReadScope(hrUser)).toEqual({});
    expect(buildInterviewReadScope(viewerUser)).toEqual({});

    const sample = { created_by: otherTaUser.id, demands: { contact_profile_id: otherAmUser.id, spoc_profile_id: spocUser.id } };
    expect(canViewInterview(spocUser, sample)).toBe(true);
    expect(canViewInterview(hrUser, sample)).toBe(true);
    expect(canViewInterview(viewerUser, sample)).toBe(true);
  });

  it('Unauthenticated or invalid roles fail closed', () => {
    expect(buildInterviewReadScope({ role: null, id: null })).toEqual({ id: '__no_access__' });
    expect(buildInterviewReadScope({ role: 'unknown', id: '123' })).toEqual({ id: '__no_access__' });
    expect(canViewInterview({ role: null, id: null }, { created_by: 'any' })).toBe(false);
  });
});

describe('New Columns Data Formatting (Client and Account Manager)', () => {
  it('Formats Client 3 lines with bold company name, client name, and email', () => {
    const fullClient = {
      client_company_name: 'Acme Corp',
      client_name: 'John Doe',
      client_company_email: 'contact@acme.com',
    };
    expect(fullClient.client_company_name || '—').toBe('Acme Corp');
    expect(fullClient.client_name || '—').toBe('John Doe');
    expect(fullClient.client_company_email || '—').toBe('contact@acme.com');

    const partialClient = {
      client_company_name: 'Acme Corp',
      client_name: null,
      client_company_email: null,
    };
    expect(partialClient.client_company_name || '—').toBe('Acme Corp');
    expect(partialClient.client_name || '—').toBe('—');
    expect(partialClient.client_company_email || '—').toBe('—');
  });

  it('Formats Account Manager name and email, or — when demand has no AM', () => {
    const withAm = { am_name: 'Jane Smith', am_email: 'jane@costaff.com' };
    expect(withAm.am_name).toBe('Jane Smith');
    expect(withAm.am_email || '—').toBe('jane@costaff.com');

    const withoutAm = { am_name: null, am_email: null };
    expect(withoutAm.am_name ? `${withoutAm.am_name} / ${withoutAm.am_email}` : '—').toBe('—');
  });
});

describe('Company and AM Filter Query Construction', () => {
  function buildDemandConditions(readScope: any, company?: string, am?: string) {
    const conditions: any[] = [];
    if (readScope.demands) conditions.push(readScope.demands);
    if (company) {
      conditions.push({
        OR: [
          { company_id: company },
          { companies: { id: company } },
          { companies: { name: { equals: company, mode: 'insensitive' } } },
          { company_name: { equals: company, mode: 'insensitive' } },
        ],
      });
    }
    if (am) {
      conditions.push({
        OR: [
          { contact_profile_id: am },
          { profiles_demands_contact_profileToprofiles: { id: am } },
          { profiles_demands_contact_profileToprofiles: { full_name: { equals: am, mode: 'insensitive' } } },
        ],
      });
    }
    return conditions;
  }

  it('Company filter creates company match condition', () => {
    const conds = buildDemandConditions({}, 'cmp-123');
    expect(conds).toHaveLength(1);
    expect(conds[0].OR).toBeDefined();
    expect(conds[0].OR[0]).toEqual({ company_id: 'cmp-123' });
  });

  it('AM filter creates AM match condition', () => {
    const conds = buildDemandConditions({}, undefined, 'am-456');
    expect(conds).toHaveLength(1);
    expect(conds[0].OR).toBeDefined();
    expect(conds[0].OR[0]).toEqual({ contact_profile_id: 'am-456' });
  });

  it('Both filters combine with role read scope without clobbering', () => {
    const amScope = { demands: { contact_profile_id: 'am-111' } };
    const conds = buildDemandConditions(amScope, 'cmp-222', 'am-111');
    expect(conds).toHaveLength(3);
    expect(conds[0]).toEqual({ contact_profile_id: 'am-111' });
    expect(conds[1].OR[0]).toEqual({ company_id: 'cmp-222' });
    expect(conds[2].OR[0]).toEqual({ contact_profile_id: 'am-111' });
  });
});

