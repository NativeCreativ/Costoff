import { describe, it, expect } from 'vitest';
import { parseCompanyRoundsCell } from './companyImportService';

describe('parseCompanyRoundsCell', () => {
  it('parses Round|Mode|mandatory entries, Mode and mandatory both optional', () => {
    expect(parseCompanyRoundsCell('Technical|Video call|mandatory, HR|Phone, CEO round')).toEqual([
      { name: 'Technical', mode: 'Video call', mandatory: true },
      { name: 'HR', mode: 'Phone', mandatory: false },
      { name: 'CEO round', mode: null, mandatory: false },
    ]);
  });

  it('trims every part and drops entries with no name', () => {
    expect(parseCompanyRoundsCell(' Technical | Video call | mandatory , , HR ')).toEqual([
      { name: 'Technical', mode: 'Video call', mandatory: true },
      { name: 'HR', mode: null, mandatory: false },
    ]);
  });

  it('de-dupes by round name case-insensitively, first occurrence wins', () => {
    expect(parseCompanyRoundsCell('Technical|Video call, technical|Phone|mandatory')).toEqual([
      { name: 'Technical', mode: 'Video call', mandatory: false },
    ]);
  });

  it('only the literal "mandatory" keyword sets the flag', () => {
    expect(parseCompanyRoundsCell('Technical|Video call|required')).toEqual([
      { name: 'Technical', mode: 'Video call', mandatory: false },
    ]);
  });

  it('returns an empty list for blank/undefined input', () => {
    expect(parseCompanyRoundsCell(undefined)).toEqual([]);
    expect(parseCompanyRoundsCell('')).toEqual([]);
    expect(parseCompanyRoundsCell('   ')).toEqual([]);
  });
});
