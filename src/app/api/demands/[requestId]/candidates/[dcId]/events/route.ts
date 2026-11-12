import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandPipeline } from '@/lib/auth/demandFulfillmentPermissions';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { submissionEventSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';

// GET /api/demands/[requestId]/candidates/[dcId]/events — chronological pipeline history.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string; dcId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to view this demand' }, { status: 403 });
    }

    const events = await prisma.submission_events.findMany({
      where: { submission_id: dcId },
      include: { profiles: { select: { id: true, full_name: true, role: true } } },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/[requestId]/candidates/[dcId]/events:', error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}

// POST /api/demands/[requestId]/candidates/[dcId]/events — add a note / call log / email log / etc.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string; dcId: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { requestId, dcId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    if (!canManageDemandPipeline({ role: currentUser.role, id: currentUser.userId }, demand, demand.recruiterIds)) {
      return NextResponse.json({ error: 'You do not have permission to manage this demand\'s pipeline' }, { status: 403 });
    }

    const submission = await prisma.submissions.findFirst({ where: { id: dcId, demand_id: demandId } });
    if (!submission) {
      return NextResponse.json({ error: 'Candidate not found in this demand' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = submissionEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { event_type, content, attachment_url, metadata, follow_up_at } = parsed.data;

    const event = await prisma.submission_events.create({
      data: {
        submission_id: dcId,
        event_type,
        content: content || null,
        attachment_url: attachment_url || null,
        metadata: metadata ? (metadata as any) : undefined,
        follow_up_at: follow_up_at ? new Date(`${follow_up_at}T00:00:00.000Z`) : null,
        created_by: currentUser.userId,
      },
    });

    return NextResponse.json({ event, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/candidates/[dcId]/events:', error);
    return NextResponse.json({ error: 'Failed to add event' }, { status: 500 });
  }
}
