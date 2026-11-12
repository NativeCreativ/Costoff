import { describe, it, expect } from 'vitest';
import {
  DEMAND_REQUEST_ID_HINT,
  DEMAND_REQUEST_ID_MAX_LENGTH,
  DEMAND_REQUEST_ID_RESERVED_MESSAGE,
  duplicateDemandRequestIdMessage,
  isReservedDemandRequestId,
  normalizeDemandRequestId,
  sanitizeDemandRequestIdInput,
  validateDemandRequestId,
} from '@/lib/demands/demandRequestIdRules';

describe('validateDemandRequestId', () => {
  it('treats a blank field as valid — it means "auto-generate on save"', () => {
    expect(validateDemandRequestId('')).toEqual({ ok: true, value: '' });
    expect(validateDemandRequestId('   ')).toEqual({ ok: true, value: '' });
    expect(validateDemandRequestId(null)).toEqual({ ok: true, value: '' });
    expect(validateDemandRequestId(undefined)).toEqual({ ok: true, value: '' });
  });

  it('accepts letters, digits, hyphens and underscores', () => {
    expect(validateDemandRequestId('REQ-1001')).toEqual({ ok: true, value: 'REQ-1001' });
    expect(validateDemandRequestId('a_b-9')).toEqual({ ok: true, value: 'A_B-9' });
  });

  it('stores UPPERCASE after trimming leading and trailing whitespace only', () => {
    expect(validateDemandRequestId('  req-1001  ')).toEqual({ ok: true, value: 'REQ-1001' });
    // Inner whitespace is NOT trimmed — it is simply not an allowed character.
    expect(validateDemandRequestId('REQ 1001')).toEqual({
      ok: false,
      error: 'Request ID can only contain letters, numbers, hyphens and underscores',
    });
  });

  it('rejects anything outside the allowed character set (spaces, punctuation, unicode)', () => {
    for (const bad of ['REQ/1001', 'REQ#1', 'REQ.1', 'REQ 1', 'RÉQ-1', 'REQ-1!']) {
      const result = validateDemandRequestId(bad);
      if (bad === 'RÉQ-1' || bad === 'REQ.1') {
        // Non-ASCII letters and dots are not in [A-Za-z0-9_-]; É is also multi-byte, so the
        // length check may fire first for some inputs — either way it must be rejected.
        expect(result.ok).toBe(false);
        continue;
      }
      expect(result.ok).toBe(false);
    }
  });

  it('requires 3 to 30 characters', () => {
    const tooShort = validateDemandRequestId('AB');
    expect(tooShort.ok).toBe(false);
    expect(tooShort.ok === false && tooShort.error).toContain('between 3 and 30 characters');

    expect(validateDemandRequestId('ABC').ok).toBe(true);

    const max = 'A'.repeat(DEMAND_REQUEST_ID_MAX_LENGTH);
    expect(validateDemandRequestId(max).ok).toBe(true);

    const tooLong = validateDemandRequestId('A'.repeat(DEMAND_REQUEST_ID_MAX_LENGTH + 1));
    expect(tooLong.ok).toBe(false);
    expect(tooLong.ok === false && tooLong.error).toContain('between 3 and 30 characters');
  });

  it('requires the ID to start with a letter or a digit', () => {
    const result = validateDemandRequestId('-REQ');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('Request ID must start with a letter or a number');
    expect(validateDemandRequestId('_REQ').ok).toBe(false);
    expect(validateDemandRequestId('1REQ').ok).toBe(true);
  });

  it('rejects the reserved auto-generated format with the exact required wording', () => {
    for (const reserved of ['CSF-2026-0016', 'csf-2026-0016', ' Csf-2026-0001 ']) {
      const result = validateDemandRequestId(reserved);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBe('This format is reserved for auto-generated IDs');
    }
    // Only the exact CSF-YYYY-NNNN shape is reserved — a similar manual ID is fine.
    expect(validateDemandRequestId('CSF-26-0016').ok).toBe(true);
    expect(validateDemandRequestId('REQ-2026-0016').ok).toBe(true);
    expect(isReservedDemandRequestId('csf-2026-0016')).toBe(true);
    expect(isReservedDemandRequestId('csf-26-0016')).toBe(false);
  });

  it('exports the hint text the field shows under the input', () => {
    expect(DEMAND_REQUEST_ID_HINT).toBe('Letters, numbers, - and _ only. 3 to 30 characters.');
  });
});

describe('sanitizeDemandRequestIdInput', () => {
  it('strips disallowed characters, uppercases and caps the length as the user types', () => {
    expect(sanitizeDemandRequestIdInput('re q#1')).toBe('REQ1');
    expect(sanitizeDemandRequestIdInput('  req-1001  ')).toBe('REQ-1001');
    expect(sanitizeDemandRequestIdInput('a'.repeat(40)).length).toBe(DEMAND_REQUEST_ID_MAX_LENGTH);
  });

  it('leaves an empty field empty', () => {
    expect(sanitizeDemandRequestIdInput('')).toBe('');
  });
});

describe('normalizeDemandRequestId', () => {
  it('trims and uppercases without touching anything else', () => {
    expect(normalizeDemandRequestId('  re q-1 ')).toBe('RE Q-1');
  });
});

describe('duplicateDemandRequestIdMessage', () => {
  it('names the ID that is taken', () => {
    expect(duplicateDemandRequestIdMessage('REQ-1001')).toBe('Request ID "REQ-1001" already exists');
  });
});