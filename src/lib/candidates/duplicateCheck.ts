import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { normalizeEmail, normalizePhone } from '@/lib/candidateNormalize';

export interface DuplicateCandidateRef {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface DuplicateCandidateMatch {
  field: 'email' | 'phone' | 'both';
  existingCandidate: DuplicateCandidateRef;
  /** Only set when email and phone each matched a DIFFERENT existing candidate. */
  secondCandidate?: DuplicateCandidateRef;
}

/**
 * Finds whether an email/phone pair already belongs to another candidate, checking BOTH fields
 * (never short-circuiting on the first match) so a caller can report `field: 'both'` — either
 * one candidate matching on both, or two different candidates each matching one field.
 *
 * Normalization mirrors the DB's own partial unique indexes exactly
 * (candidates_normalized_email_key: LOWER(TRIM(email)); candidates_normalized_phone_key:
 * regexp_replace(phone, '\D', '', 'g')) via normalizeEmail/normalizePhone, so the API-level
 * check and the DB-level guarantee can never disagree. Empty values are skipped (no query).
 *
 * The one shared implementation for every create/update/import path — do not re-query email or
 * phone duplicates elsewhere; import this instead.
 */
export async function findDuplicateCandidate(
  email: string | null | undefined,
  phone: string | null | undefined,
  excludeId?: string
): Promise<DuplicateCandidateMatch | null> {
  const normalizedEmail = email ? normalizeEmail(email) : '';
  const normalizedPhone = phone ? normalizePhone(phone) : '';

  const excludeClause = excludeId ? Prisma.sql`AND id != ${excludeId}::uuid` : Prisma.empty;

  const [emailMatches, phoneMatches] = await Promise.all([
    normalizedEmail
      ? prisma.$queryRaw<DuplicateCandidateRef[]>`
          SELECT id, full_name, email, phone FROM candidates
          WHERE LOWER(TRIM(email)) = ${normalizedEmail}
          ${excludeClause}
          LIMIT 1
        `
      : Promise.resolve([] as DuplicateCandidateRef[]),
    normalizedPhone
      ? prisma.$queryRaw<DuplicateCandidateRef[]>`
          SELECT id, full_name, email, phone FROM candidates
          -- '\\D' (escaped): inside a JS template literal a bare '\D' arrives in SQL as 'D', so the
          -- comparison stripped the letter D instead of non-digits and never matched a phone.
          WHERE regexp_replace(phone, '\\D', '', 'g') = ${normalizedPhone}
          ${excludeClause}
          LIMIT 1
        `
      : Promise.resolve([] as DuplicateCandidateRef[]),
  ]);

  const emailMatch = emailMatches[0] ?? null;
  const phoneMatch = phoneMatches[0] ?? null;

  if (emailMatch && phoneMatch) {
    if (emailMatch.id === phoneMatch.id) {
      return { field: 'both', existingCandidate: emailMatch };
    }
    return { field: 'both', existingCandidate: emailMatch, secondCandidate: phoneMatch };
  }
  if (emailMatch) return { field: 'email', existingCandidate: emailMatch };
  if (phoneMatch) return { field: 'phone', existingCandidate: phoneMatch };
  return null;
}

/** Human-readable message for a DuplicateCandidateMatch, shared by every API response. */
export function duplicateCandidateMessage(match: DuplicateCandidateMatch): string {
  if (match.field === 'both' && match.secondCandidate) {
    return `A candidate with this email already exists (${match.existingCandidate.full_name}), and a candidate with this phone number already exists (${match.secondCandidate.full_name}).`;
  }
  if (match.field === 'both') {
    return `A candidate with this email and phone number already exists (${match.existingCandidate.full_name}).`;
  }
  return `A candidate with this ${match.field} already exists (${match.existingCandidate.full_name}).`;
}
