import { describe, expect, it } from 'vitest';
import {
  normalizeCompanyRounds,
  CompanyRoundsValidationError,
} from '@/lib/companies/companyInterviewRounds';

/**
 * Covers the pure, caller-facing half of the company-rounds rules — the part every write path
 * (Add Company, Edit Company, and the demand-side first-time seed) depends on. The DB-backed
 * half (atomic seed-if-empty, the in-use guard) is exercised through the API in development.
 */
describe('normalizeCompanyRounds', () => {
  it('trims names and rewrites order as a dense 1..n sequence', () => {
    const result = normalizeCompanyRounds([
      { name: ' Technical ', order: 1, mandatory: true },
      { name: 'HR', order: 2 },
      { name: 'coding', order: 3 },
    ]);
    expect(result.map((r) => [r.name, r.order])).toEqual([
      ['Technical', 1],
      ['HR', 2],
      ['coding', 3],
    ]);
    expect(result[0].mandatory).toBe(true);
  });

  it('sorts by the supplied order, then re-densifies (sparse input cannot leave gaps)', () => {
    // The stored order is always dense 1..n because company_interview_rounds is UNIQUE on
    // (company_id, round_order) — a gap or a duplicate would make a later reorder collide.
    const result = normalizeCompanyRounds([
      { name: 'Technical', order: 9 },
      { name: 'HR', order: 2 },
      { name: 'coding', order: 40 },
    ]);
    expect(result.map((r) => [r.name, r.order])).toEqual([
      ['HR', 1],
      ['Technical', 2],
      ['coding', 3],
    ]);
  });

  it('falls back to array position when no order is supplied', () => {
    const result = normalizeCompanyRounds([{ name: 'First' }, { name: 'Second' }]);
    expect(result.map((r) => [r.name, r.order])).toEqual([
      ['First', 1],
      ['Second', 2],
    ]);
  });

  it('rejects a blank name', () => {
    expect(() => normalizeCompanyRounds([{ name: '   ' }])).toThrow(CompanyRoundsValidationError);
    expect(() => normalizeCompanyRounds([{ name: 'Technical' }, { name: '' }])).toThrow(
      'Interview round 2 has no name'
    );
  });

  it('rejects case-insensitive duplicates, naming the entry as first typed', () => {
    expect(() =>
      normalizeCompanyRounds([{ name: 'Technical' }, { name: ' technical ' }])
    ).toThrow('"Technical" is listed more than once');
  });

  it('treats an absent mandatory flag as false', () => {
    expect(normalizeCompanyRounds([{ name: 'HR' }])[0].mandatory).toBe(false);
  });

  it('accepts an empty list (clearing a company is a valid save)', () => {
    expect(normalizeCompanyRounds([])).toEqual([]);
  });

  it('trims mode, and a blank mode becomes null', () => {
    const result = normalizeCompanyRounds([
      { name: 'Technical', mode: ' Video call ' },
      { name: 'HR', mode: '   ' },
      { name: 'coding' },
    ]);
    expect(result.map((r) => r.mode)).toEqual(['Video call', null, null]);
  });

  it('treats an absent isActive as true, and passes an explicit false through', () => {
    const result = normalizeCompanyRounds([{ name: 'Technical' }, { name: 'HR', isActive: false }]);
    expect(result.map((r) => r.isActive)).toEqual([true, false]);
  });
});