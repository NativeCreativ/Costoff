import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptPan, encryptPan, normalizePan, PAN_PATTERN, withoutPanCiphertext } from './panCrypto';

describe('PAN encryption', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret';
    delete process.env.PAN_ENCRYPTION_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('round-trips and keeps only the last 4 in clear text', () => {
    const { pan_encrypted, pan_last4 } = encryptPan('ABCDE1234F');
    expect(pan_last4).toBe('234F');
    expect(pan_encrypted).not.toContain('ABCDE1234F');
    expect(decryptPan(pan_encrypted)).toBe('ABCDE1234F');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptPan('ABCDE1234F').pan_encrypted).not.toBe(encryptPan('ABCDE1234F').pan_encrypted);
  });

  it('returns null for a changed key or a tampered value', () => {
    const { pan_encrypted } = encryptPan('ABCDE1234F');
    process.env.PAN_ENCRYPTION_KEY = 'another-key';
    expect(decryptPan(pan_encrypted)).toBeNull();
    expect(decryptPan('v1:bad:data:here')).toBeNull();
    expect(decryptPan(null)).toBeNull();
  });

  it('normalizes and validates', () => {
    expect(normalizePan(' abcde 1234f ')).toBe('ABCDE1234F');
    expect(PAN_PATTERN.test('ABCDE1234F')).toBe(true);
    expect(PAN_PATTERN.test('ABCD1234F')).toBe(false);
  });

  it('strips the ciphertext from a row', () => {
    expect(withoutPanCiphertext({ id: '1', pan_encrypted: 'x', pan_last4: '234F' })).toEqual({ id: '1', pan_last4: '234F' });
  });
});
