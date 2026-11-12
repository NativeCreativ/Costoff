import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/** Liveness for the container health check. No session required (API routes skip middleware). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
