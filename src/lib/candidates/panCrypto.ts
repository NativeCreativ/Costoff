import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * PAN card numbers are stored encrypted (AES-256-GCM) in candidates.pan_encrypted, with only the
 * last 4 characters in pan_last4 for display. The API never returns pan_encrypted; the full PAN
 * is read through GET /api/candidates/[candidateId]/pan by someone who may edit the candidate.
 *
 * Key: PAN_ENCRYPTION_KEY when set, otherwise derived from SESSION_SECRET. Changing either one
 * makes PANs saved before the change unreadable, so set PAN_ENCRYPTION_KEY once and keep it.
 *
 * Stored format: "v1:<iv b64>:<tag b64>:<ciphertext b64>".
 */

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Upper-cases and strips spaces; the result is what PAN_PATTERN checks. */
export function normalizePan(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

function encryptionKey(): Buffer {
  const secret = process.env.PAN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error('PAN_ENCRYPTION_KEY or SESSION_SECRET must be set to store PAN numbers');
  return createHash('sha256').update(`costaff-pan:${secret}`).digest();
}

export function encryptPan(pan: string): { pan_encrypted: string; pan_last4: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    pan_encrypted: ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':'),
    pan_last4: pan.slice(-4),
  };
}

/** Null when the value is missing or cannot be decrypted (e.g. the key changed). */
export function decryptPan(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Removes the PAN ciphertext from a candidate row before it leaves the server. */
export function withoutPanCiphertext<T extends { pan_encrypted?: unknown }>(row: T): Omit<T, 'pan_encrypted'> {
  const { pan_encrypted: _omit, ...rest } = row;
  void _omit;
  return rest;
}
