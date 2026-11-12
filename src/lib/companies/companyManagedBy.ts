// Rule: a company is owned by exactly one person — an Account Manager if one is chosen,
// otherwise the Delivery Head who saved it. account_manager_id is AM-only; managed_by holds the
// Delivery Head. One helper resolves the pair so create, edit, the Add Client drawer and bulk
// import can never disagree.

import { lookupCompanyAccountManagerById } from '@/lib/companies/companyAccountManager';
import { prisma } from '@/lib/db/prisma';
import type { CompanyRoundsClient as PrismaCompaniesClient } from '@/lib/companies/companyInterviewRounds';

/** Hint under the Account Manager field: an empty AM means the logged-in Delivery Head owns it. */
export const COMPANY_AM_FIELD_HINT = 'Defaults to you if left empty';

export interface CompanyManagerPair {
  /** An account_manager profiles.id, or null when the client is managed by a Delivery Head. */
  account_manager_id: string | null;
  /** The Delivery Head's profiles.id, or null when a real AM is set. */
  managed_by: string | null;
}

/** Thrown when a supplied AM is not a real account_manager profile — the route answers 400. */
export class CompanyAccountManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyAccountManagerError';
  }
}

interface CompanyManagerActor {
  userId: string;
}

/**
 * THE single resolver of the AM / managed_by pair.
 *
 * `requestedAccountManagerId` comes from the payload and is only ever an AM:
 *   - non-empty  -> must resolve to an account_manager profile, else rejected (400)
 *   - empty/null -> no AM, so `managed_by` becomes the session's Delivery Head
 *
 * `actor` is taken from the authenticated session by the caller and is NEVER read from the
 * request body, so a caller cannot hand their client to another Delivery Head.
 */
export async function resolveCompanyManager(
  requestedAccountManagerId: string | null | undefined,
  actor: CompanyManagerActor,
  client?: PrismaCompaniesClient
): Promise<CompanyManagerPair> {
  const trimmed = typeof requestedAccountManagerId === 'string' ? requestedAccountManagerId.trim() : '';

  if (!trimmed) {
    // No AM chosen: the Delivery Head who saved the company manages it.
    return { account_manager_id: null, managed_by: actor.userId };
  }

  const am = await lookupCompanyAccountManagerById(trimmed, client ?? prisma);
  if (!am) {
    throw new CompanyAccountManagerError('Account Manager must be an existing Account Manager profile');
  }
  return { account_manager_id: am.id, managed_by: null };
}

