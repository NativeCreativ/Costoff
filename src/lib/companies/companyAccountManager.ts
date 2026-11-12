// The company-level SPOC was replaced by an Account Manager (migration 20261019100000). Same
// shape as the demand-side validation it replaced: a profiles row of the right role, or null.

import { prisma } from '@/lib/db/prisma';

export interface CompanyAccountManagerProfile {
  id: string;
  full_name: string;
  email: string;
}

/** `client` lets a caller validate inside an open transaction (the shared manager resolver). */
export async function lookupCompanyAccountManagerById(
  id: string,
  client?: Pick<typeof prisma, 'profiles'>
): Promise<CompanyAccountManagerProfile | null> {
  if (!id || id.trim() === '') return null;
  const db = client ?? prisma;
  const profile = await db.profiles.findUnique({
    where: { id },
    select: { id: true, full_name: true, email: true, role: true },
  });
  if (!profile || profile.role !== 'account_manager') return null;
  return { id: profile.id, full_name: profile.full_name, email: profile.email };
}

export async function lookupCompanyAccountManagerByEmail(email: string): Promise<CompanyAccountManagerProfile | null> {
  if (!email || email.trim() === '') return null;
  const profile = await prisma.profiles.findUnique({
    where: { email: email.trim() },
    select: { id: true, full_name: true, email: true, role: true },
  });
  if (!profile || profile.role !== 'account_manager') return null;
  return { id: profile.id, full_name: profile.full_name, email: profile.email };
}