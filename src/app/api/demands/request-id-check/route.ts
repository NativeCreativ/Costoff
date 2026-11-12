import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { validateDemandRequestId } from '@/lib/demands/demandRequestIdRules';
import { isDemandRequestIdTaken } from '@/lib/demands/demandRequestId';

// GET /api/demands/request-id-check?requestId=REQ-01&exclude=<demandId>
// Availability probe for the Add Demand form's inline "already exists" error. A hint only -
// POST /api/demands re-checks inside its transaction and answers 409. Any authenticated role
// may call it: it reveals nothing beyond an ID already visible in the demand list.
export async function GET(request: Request) {
  try {
    await requireAuth();

    const params = new URL(request.url).searchParams;
    const requestId = params.get('requestId') ?? '';
    const exclude = params.get('exclude') || undefined;

    const validation = validateDemandRequestId(requestId);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error, available: false }, { status: 400 });
    }
    // Blank means "auto-generate on save", which is never a duplicate.
    if (validation.value === '') {
      return NextResponse.json({ available: true });
    }

    const available = !(await isDemandRequestIdTaken(validation.value, prisma, exclude));
    return NextResponse.json({ available, requestId: validation.value });
  } catch (error) {
    console.error('Error in GET /api/demands/request-id-check:', error);
    return NextResponse.json({ error: 'Failed to check Request ID' }, { status: 500 });
  }
}