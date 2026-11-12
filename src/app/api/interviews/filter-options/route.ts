import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildInterviewReadScope } from '@/lib/auth/interviewPermissions';

/**
 * GET /api/interviews/filter-options?type=company|am|round|mode&search=&limit=
 *
 * Returns the distinct filter option values scoped ONLY by the calling user's role
 * visibility (TA: own created interviews, AM: own demands, Super Admin / Delivery Head: all).
 * It deliberately does NOT depend on any filter, search, page or sort state coming from the
 * Interviews Tracking Log, so the dropdown options never shrink while the user is filtering.
 */
export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const readScope = buildInterviewReadScope({ role: currentUser.role, id: currentUser.userId });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);

    type Option = { value: string; label: string };

    // Base demand filter from role visibility.
    const interviewsWhere: Prisma.interviewsWhereInput = readScope
      ? { demands: readScope as any }
      : {};

    const norm = (s: string | null | undefined): string => (s || '').trim();

    if (type === 'company') {
      const rows = await prisma.interviews.findMany({
        where: interviewsWhere,
        include: { demands: { select: { companies: { select: { id: true, name: true, client_name: true, email: true } } } } },
        take: 1000,
      });
      const seen = new Set<string>();
      const options: Option[] = [];
      for (const r of rows) {
        const c = (r as any).demands?.companies;
        if (!c) continue;
        const label = norm(c.client_name) || norm(c.name);
        if (!label) continue;
        if (seen.has(c.id)) continue;
        const searchMatch =
          !search ||
          label.toLowerCase().includes(search.toLowerCase()) ||
          (c.email || '').toLowerCase().includes(search.toLowerCase());
        if (searchMatch) {
          seen.add(c.id);
          options.push({ value: c.id, label: c.client_name || c.name });
        }
        if (options.length >= limit) break;
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return NextResponse.json({ options: options.slice(0, limit) });
    }

    if (type === 'am') {
      const rows = await prisma.interviews.findMany({
        where: interviewsWhere,
        include: { demands: { select: { contact_profile_id: true, profiles_demands_contact_profileToprofiles: { select: { id: true, full_name: true, email: true } } } } },
        take: 1000,
      });
      const seen = new Set<string>();
      const options: Option[] = [];
      for (const r of rows) {
        const am = (r as any).demands?.profiles_demands_contact_profileToprofiles;
        if (!am) continue;
        const label = norm(am.full_name);
        if (!label) continue;
        if (seen.has(am.id)) continue;
        const searchMatch =
          !search ||
          label.toLowerCase().includes(search.toLowerCase()) ||
          (am.email || '').toLowerCase().includes(search.toLowerCase());
        if (searchMatch) {
          seen.add(am.id);
          options.push({ value: am.id, label: `${am.full_name} (${am.email})` });
        }
        if (options.length >= limit) break;
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return NextResponse.json({ options: options.slice(0, limit) });
    }

    if (type === 'round') {
      const rows = await prisma.interviews.findMany({
        where: interviewsWhere,
        distinct: ['level'],
        select: { level: true },
      });
      const options: Option[] = [];
      for (const r of rows) {
        const v = (r as any).level;
        if (!v) continue;
        if (search && !v.toLowerCase().includes(search.toLowerCase())) continue;
        options.push({ value: v, label: v });
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return NextResponse.json({ options: options.slice(0, limit) });
    }

    if (type === 'mode') {
      const rows = await prisma.interviews.findMany({
        where: interviewsWhere,
        distinct: ['mode'],
        select: { mode: true },
      });
      const options: Option[] = [];
      for (const r of rows) {
        const v = (r as any).mode;
        if (!v) continue;
        if (search && !v.toLowerCase().includes(search.toLowerCase())) continue;
        options.push({ value: v, label: v });
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return NextResponse.json({ options: options.slice(0, limit) });
    }

    return NextResponse.json({ options: [] as Option[] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/interviews/filter-options:', error);
    return NextResponse.json({ options: [] }, { status: 500 });
  }
}
