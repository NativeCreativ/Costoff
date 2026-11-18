import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canEditCandidate, loadCandidateAccessContext } from '@/lib/auth/candidatePermissions';
import { decryptPan } from '@/lib/candidates/panCrypto';

/**
 * GET /api/candidates/[candidateId]/pan — the full PAN, decrypted. Only someone who may edit the
 * candidate can read it (everyone else sees pan_last4 only). Not cached by the browser.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { candidateId } = await params;
    const access = await loadCandidateAccessContext(candidateId);
    if (!access) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    if (!canEditCandidate({ role: currentUser.role, id: currentUser.userId }, access)) {
      return NextResponse.json({ error: 'You do not have permission to see this PAN' }, { status: 403 });
    }
    const row = await prisma.candidates.findUnique({ where: { id: candidateId }, select: { pan_encrypted: true } });
    const pan = decryptPan(row?.pan_encrypted);
    return NextResponse.json({ pan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/candidates/[candidateId]/pan:', error);
    return NextResponse.json({ error: 'Failed to load the PAN' }, { status: 500 });
  }
}
