import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageCompanyInterviewRounds } from '@/lib/auth/companyPermissions';
import { interviewRoundSchema } from '@/components/companies/company.schema';
import { findByNormalizedName, isUniqueViolation } from '@/lib/masters/masterName';

/**
 * POST /api/interview-rounds — create-or-reuse a master round by normalized name.
 *
 * This is what powers the inline "+ Add Round" chip on the Company and Demand round
 * configurators. Typing "Architecture Review" here creates ONE master record that is then
 * immediately selectable in every other surface; typing " HR " when "hr" already exists
 * returns that existing record with `created: false` instead of erroring or duplicating —
 * so the same round can never exist twice under different spellings/casing.
 *
 * `sort_order` only advances when a genuinely new round is created, which keeps the master
 * list in creation order without disturbing the existing Technical/HR ordering on re-save.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canManageCompanyInterviewRounds(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to create interview rounds' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = interviewRoundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name } = parsed.data;

    const existing = await findByNormalizedName<{ id: string; name: string; is_active: boolean }>(
      prisma.interview_rounds
    )(name);
    if (existing) {
      // Reuse as-is. A deactivated round being reused is reactivated rather than rejected,
      // so a previously-retired name becomes selectable again instead of being a dead end.
      const round = existing.is_active
        ? existing
        : await prisma.interview_rounds.update({ where: { id: existing.id }, data: { is_active: true } });
      return NextResponse.json({ round, created: false, success: true });
    }

    const maxSort = await prisma.interview_rounds.aggregate({ _max: { sort_order: true } });

    let round;
    try {
      round = await prisma.interview_rounds.create({
        data: { name: name.trim(), sort_order: (maxSort._max.sort_order ?? 0) + 1, is_active: true },
      });
    } catch (dbError) {
      if (isUniqueViolation(dbError)) {
        const winner = await findByNormalizedName<{ id: string; name: string; is_active: boolean }>(
          prisma.interview_rounds
        )(name);
        if (winner) return NextResponse.json({ round: winner, created: false, success: true });
      }
      throw dbError;
    }

    return NextResponse.json({ round, created: true, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'An interview round with that name already exists' }, { status: 409 });
    }
    console.error('Error in POST /api/interview-rounds:', error);
    return NextResponse.json({ error: 'Failed to create interview round' }, { status: 500 });
  }
}