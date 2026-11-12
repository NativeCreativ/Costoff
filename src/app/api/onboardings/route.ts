import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const bgv = searchParams.get('bgv') || '';

    const where: any = {};
    if (status) where.status = status;
    if (bgv) where.bgv_status = bgv;
    if (search) {
      where.OR = [
        { status: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.onboardings.findMany({
      where,
      include: {
        candidates: { select: { full_name: true, email: true, phone: true } },
        demands: { select: { request_id: true, skill_description: true, client_name: true } },
        offers: { select: { offered_ctc: true, offer_date: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const onboardings = data.map(o => ({
      ...o,
      offers: o.offers
        ? { ...o.offers, offered_ctc: toNum(o.offers.offered_ctc) }
        : null,
    }));

    return NextResponse.json({ onboardings });
  } catch (err) {
    console.error('Error in GET /api/onboardings:', err);
    return NextResponse.json({ onboardings: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newOnboarding: any = {
      offer_id: body.offer_id || null,
      candidate_id: body.candidate_id || null,
      demand_id: body.demand_id || null,
      bgv_status: body.bgv_status || 'in_progress',
      actual_joining_date: body.actual_joining_date
        ? new Date(body.actual_joining_date)
        : null,
      status: body.status || 'yet_to_join',
      notes: body.notes || '',
    };

    const created = await prisma.onboardings.create({ data: newOnboarding });
    return NextResponse.json({ onboarding: created, success: true });
  } catch (err) {
    console.error('Error in POST /api/onboardings:', err);
    return NextResponse.json({ error: 'Failed to create onboarding' }, { status: 500 });
  }
}
