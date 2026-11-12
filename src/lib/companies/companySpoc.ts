import { prisma } from '@/lib/db/prisma';

/**
 * A company's SPOC must be a real profiles row whose role is 'spoc'.
 *
 * This is deliberately the same rule the Demand form applies to `demands.spoc_profile_id` (see
 * validateSpocAssignment in app/api/demands/route.ts), re-implemented here rather than shared so
 * the Demand write path is left untouched. Any authenticated role may assign any SPOC — there is
 * no ownership restriction, because a company SPOC is not a per-demand assignment.
 *
 * Two selectors, because two callers legitimately hold different keys: the form/API paths hold
 * the stored `profiles.id`, while a bulk import holds the human-typeable `profiles.email`.
 * Neither is guessed from the other, so a malformed value can never reach the driver.
 */
export interface CompanySpocProfile {
  id: string;
  role: string;
  full_name: string;
  email: string;
}

const SPOC_SELECT = { id: true, role: true, full_name: true, email: true } as const;

export async function lookupCompanySpocById(id: string): Promise<CompanySpocProfile | null> {
  if (!id.trim()) return null;
  const profile = await prisma.profiles.findUnique({ where: { id: id.trim() }, select: SPOC_SELECT });
  return profile?.role === 'spoc' ? profile : null;
}

export async function lookupCompanySpocByEmail(email: string): Promise<CompanySpocProfile | null> {
  const term = email.trim();
  if (!term) return null;
  const profile = await prisma.profiles.findFirst({
    where: { email: { equals: term, mode: 'insensitive' } },
    select: SPOC_SELECT,
  });
  return profile?.role === 'spoc' ? profile : null;
}