import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import {
  canAccessCandidate,
  canLogCandidateConversation,
  loadCandidateAccessContext,
} from '@/lib/auth/candidatePermissions';
import { candidateConversationSchema } from '@/components/candidates/candidate.schema';

const CONVERSATION_LIMIT = 200;

function serialize(row: {
  id: string;
  channel: string;
  content: string;
  created_at: Date;
  demand_id: string | null;
  profiles: { full_name: string } | null;
  demands: { request_id: string } | null;
}) {
  return {
    id: row.id,
    channel: row.channel,
    content: row.content,
    created_at: row.created_at.toISOString(),
    demand_id: row.demand_id,
    request_id: row.demands?.request_id ?? null,
    created_by_name: row.profiles?.full_name ?? null,
  };
}

const INCLUDE = { profiles: { select: { full_name: true } }, demands: { select: { request_id: true } } } as const;

/**
 * GET /api/candidates/[candidateId]/conversations — the candidate's Conversation Log, newest
 * first. Same read rule as the candidate itself (canAccessCandidate). `can_add` tells the UI
 * whether to show the entry box; the POST re-checks.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { candidateId } = await params;
    const access = await loadCandidateAccessContext(candidateId);
    if (!access) return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    const actor = { role: currentUser.role, id: currentUser.userId };
    if (!canAccessCandidate(actor, access)) {
      return NextResponse.json({ error: 'You do not have permission to access this candidate' }, { status: 403 });
    }

    const rows = await prisma.candidate_conversations.findMany({
      where: { candidate_id: candidateId },
      orderBy: { created_at: 'desc' },
      take: CONVERSATION_LIMIT,
      include: INCLUDE,
    });
    return NextResponse.json({ conversations: rows.map(serialize), can_add: canLogCandidateConversation(actor, access) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/candidates/[candidateId]/conversations:', error);
    return NextResponse.json({ error: 'Failed to load the conversation log' }, { status: 500 });
  }
}

/** POST /api/candidates/[candidateId]/conversations — add one entry. Append-only. */
export async function POST(request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { candidateId } = await params;
    const access = await loadCandidateAccessContext(candidateId);
    if (!access) return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    if (!canLogCandidateConversation({ role: currentUser.role, id: currentUser.userId }, access)) {
      return NextResponse.json({ error: 'You do not have permission to log a conversation for this candidate' }, { status: 403 });
    }

    const parsed = candidateConversationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { channel, content, demand_id: demandId } = parsed.data;
    // A demand reference must be one this candidate is actually in, so the log cannot be used
    // to attach notes to unrelated requirements.
    if (demandId && !access.demands.some((d) => d.demand_id === demandId)) {
      return NextResponse.json({ error: 'This candidate is not in that demand' }, { status: 400 });
    }

    const row = await prisma.candidate_conversations.create({
      data: { candidate_id: candidateId, channel, content, demand_id: demandId ?? null, created_by: currentUser.userId },
      include: INCLUDE,
    });
    return NextResponse.json({ conversation: serialize(row), success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/candidates/[candidateId]/conversations:', error);
    return NextResponse.json({ error: 'Failed to save the conversation' }, { status: 500 });
  }
}
