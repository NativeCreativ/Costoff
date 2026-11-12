import { describe, it, expect } from 'vitest';
import {
  guessFieldForHeader,
  guessFieldMapping,
  applyColumnMapping,
  splitCommaList,
  validateImportUpload,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_FILE_BYTES,
} from './workbook';

const FIELDS = [
  { key: 'name', label: 'Company Name', required: true, aliases: ['company', 'name'], example: 'Acme' },
  { key: 'spoc_email', label: 'SPOC Email', required: false, aliases: ['spoc'], example: 's@x.com' },
] as const;

describe('guessFieldForHeader', () => {
  it('matches a field label case- and whitespace-insensitively', () => {
    expect(guessFieldForHeader('  company name ', FIELDS)).toBe('name');
  });

  it('matches an alias', () => {
    expect(guessFieldForHeader('SPOC', FIELDS)).toBe('spoc_email');
  });

  it('returns null for an unknown header', () => {
    expect(guessFieldForHeader('Something Else', FIELDS)).toBeNull();
  });
});

describe('guessFieldMapping', () => {
  it('maps every recognised header and leaves the rest unmapped', () => {
    const mapping = guessFieldMapping(['Company Name', 'Nope', 'SPOC Email'], FIELDS);
    expect(mapping).toEqual({ name: 'Company Name', spoc_email: 'SPOC Email' });
  });

  it('keeps the first header that matches a field', () => {
    const mapping = guessFieldMapping(['company', 'Company Name'], FIELDS);
    expect(mapping.name).toBe('company');
  });
});

describe('applyColumnMapping', () => {
  it('reads values through the mapping and blanks unmapped fields', () => {
    const out = applyColumnMapping({ A: 'Acme', B: 's@x.com' }, { name: 'A' }, FIELDS);
    expect(out.name).toBe('Acme');
    expect(out.spoc_email).toBe('');
  });
});

describe('splitCommaList', () => {
  it('trims, drops blanks and keeps order', () => {
    expect(splitCommaList(' a , ,b ,  ')).toEqual(['a', 'b']);
  });

  it('returns an empty list for an empty value', () => {
    expect(splitCommaList(undefined)).toEqual([]);
    expect(splitCommaList('')).toEqual([]);
  });
});

describe('validateImportUpload', () => {
  const file = (name: string, size: number) => ({ name, size }) as File;

  it('accepts .xlsx, .xls and .csv', () => {
    expect(validateImportUpload(file('a.XLSX', 10))).toBeNull();
    expect(validateImportUpload(file('b.xls', 10))).toBeNull();
    expect(validateImportUpload(file('c.csv', 10))).toBeNull();
  });

  it('rejects any other extension', () => {
    expect(validateImportUpload(file('a.pdf', 10))).toBe('Only .xlsx, .xls and .csv files are supported');
  });

  it('rejects an oversized file', () => {
    expect(validateImportUpload(file('a.csv', MAX_IMPORT_FILE_BYTES + 1))).toContain('File is too large');
  });

  it('exposes the shared row ceiling', () => {
    expect(MAX_IMPORT_ROWS).toBe(2000);
  });
});