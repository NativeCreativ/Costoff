/**
 * Role lookup for the "creator owns edit/delete" rule. `creatorScope.ts` holds the pure
 * decision; this only answers the one question it cannot answer on its own — is the
 * record's creator actually a Recruiter, or an Account Manager / Super Admin?
 *
 * Server-only: it reads prisma. Client components must rely on the server-computed
 * `can_edit` / `can_manage` flags instead.
 */

import { prisma } from '@/lib/db/prisma';
import { RECRUITER_PROFILE_ROLE } from '@/lib/demandFulfillment/constants';

export const isRecruiterRole = (role?: string | null): boolean => !!role && role === RECRUITER_PROFILE_ROLE;

/** Which of `ids` are Recruiters. Unknown/null ids are simply absent from the set. */
export async function recruiterProfileIds(
  ids: readonly (string | null | undefined)[]
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Set();
  const rows = await prisma.profiles.findMany({
    where: { id: { in: unique } },
    select: { id: true, role: true },
  });
  return new Set(rows.filter((r) => isRecruiterRole(r.role)).map((r) => r.id));
}
