import { describe, it, expect } from 'vitest';
import { COMPANY_IMPORT_FIELDS, companyStatusLabel, guessCompanyFieldForHeader } from './companyImportFields';

describe('COMPANY_IMPORT_FIELDS', () => {
  it('requires exactly Client Name', () => {
    expect(COMPANY_IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual(['name']);
  });

  it('carries the Account Manager Email and Interview Rounds columns', () => {
    const keys = COMPANY_IMPORT_FIELDS.map((f) => f.key);
    expect(keys).toContain('am_email');
    expect(keys).toContain('interview_rounds');
  });

  it('gives every field a label, example and at least one alias', () => {
    for (const f of COMPANY_IMPORT_FIELDS) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.aliases.length).toBeGreaterThan(0);
      expect(typeof f.example).toBe('string');
    }
  });
});

describe('guessCompanyFieldForHeader', () => {
  it('auto-maps the template headers', () => {
    expect(guessCompanyFieldForHeader('Company Name')).toBe('name');
    expect(guessCompanyFieldForHeader('am email')).toBe('am_email');
    expect(guessCompanyFieldForHeader('Interview Rounds')).toBe('interview_rounds');
  });
});

describe('Interview Rounds field', () => {
  it('documents the Round|Mode|mandatory cell format, not a plain name list', () => {
    const field = COMPANY_IMPORT_FIELDS.find((f) => f.key === 'interview_rounds');
    expect(field?.example).toContain('|');
    expect(field?.hint).toMatch(/mandatory/i);
  });
});

describe('companyStatusLabel', () => {
  it('accepts either casing and normalises to the store enum', () => {
    expect(companyStatusLabel('active')).toBe('ACTIVE');
    expect(companyStatusLabel('Active')).toBe('ACTIVE');
    expect(companyStatusLabel('Inactive')).toBe('INACTIVE');
    expect(companyStatusLabel('INACTIVE')).toBe('INACTIVE');
  });

  it('defaults anything unrecognised to ACTIVE', () => {
    expect(companyStatusLabel('anything else')).toBe('ACTIVE');
    expect(companyStatusLabel('')).toBe('ACTIVE');
  });
});