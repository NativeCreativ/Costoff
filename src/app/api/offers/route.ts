import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function serializeOffer(o: any) {
  return {
    ...o,
    offered_ctc: toNum(o.offered_ctc),
    candidates: o.candidates
      ? {
          ...o.candidates,
          current_ctc: toNum(o.candidates.current_ctc),
          expected_ctc: toNum(o.candidates.expected_ctc),
        }
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { status: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.offers.findMany({
      where,
      include: {
        candidates: { select: { full_name: true, email: true, phone: true } },
        demands: { select: { request_id: true, skill_description: true, client_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ offers: data.map(serializeOffer) });
  } catch (err) {
    console.error('Error in GET /api/offers:', err);
    return NextResponse.json({ offers: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newOffer: any = {
      candidate_id: body.candidate_id || null,
      demand_id: body.demand_id || null,
      submission_id: body.submission_id || null,
      offered_ctc: body.offered_ctc ? parseFloat(body.offered_ctc) : null,
      offer_date: body.offer_date
        ? new Date(body.offer_date)
        : new Date(),
      status: body.status || 'Pending',
      notes: body.notes || '',
    };

    const created = await prisma.offers.create({ data: newOffer });
    return NextResponse.json({ offer: serializeOffer(created), success: true });
  } catch (err) {
    console.error('Error in POST /api/offers:', err);
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 });
    }

    await prisma.offers.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/offers:', err);
    return NextResponse.json({ error: 'Failed to delete offer' }, { status: 500 });
  }
}
