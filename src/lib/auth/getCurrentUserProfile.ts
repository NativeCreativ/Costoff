import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import type { Profile } from '@/components/types';

/**
 * Server-only: resolves the full profile for the current session, in-process
 * (no HTTP round trip). Mirrors /api/auth/me exactly so the two stay interchangeable —
 * used to seed the currentUser query cache during SSR so the client never has to
 * wait on a fetch for data the server already had before the page rendered.
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const session = await getCurrentUser();
  if (!session) return null;

  const profile = await prisma.profiles.findUnique({ where: { id: session.userId } });
  if (!profile) return null;

  const { password_hash: _omit, ...safeProfile } = profile;
  // Matches the shape NextResponse.json() produces over HTTP (Dates -> ISO strings),
  // since this also seeds the same client query cache that /api/auth/me feeds.
  return JSON.parse(JSON.stringify(safeProfile)) as Profile;
}
