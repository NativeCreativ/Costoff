import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildCandidateVisibilityCondition } from '@/lib/auth/candidatePermissions';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';
import { READY_TO_JOIN_NOTICE_PERIODS, PLACED_SUBMISSION_STATUSES } from '@/lib/reports/readyToJoin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANDIDATE_LIMIT = 300;

/**
 * GET /api/reports/ready-to-join[?skillGroup=<id>|none][&location=<name>|none]
 *
 * Advanced Report 1 — candidates in our database who can join now (see readyToJoin.ts for the
 * definition), by Skill Group; drill into one group to see it by location, and into a location
 * for the candidate list. Scoped by the candidate read rule (buildCandidateVisibilityCondition).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const skillGroup = searchParams.get('skillGroup') || '';
    const location = searchParams.get('location');
    if (skillGroup && skillGroup !== 'none' && !UUID_RE.test(skillGroup)) {
      return NextResponse.json({ error: 'Unknown skill group' }, { status: 400 });
    }
    const today = todayInIndia();

    const conditions: Prisma.Sql[] = [
      Prisma.sql`COALESCE(c.profile_archived, false) = false`,
      Prisma.sql`(c.availability = ANY(${READY_TO_JOIN_NOTICE_PERIODS}) OR c.available_from <= ${today}::date)`,
      // Already placed (offer accepted onwards) on some demand = not available.
      Prisma.sql`NOT EXISTS (SELECT 1 FROM submissions s WHERE s.candidate_id = c.id AND s.current_status = ANY(${PLACED_SUBMISSION_STATUSES}))`,
    ];
    const scope = buildCandidateVisibilityCondition({ role: user.role, id: user.userId }, 'c');
    if (scope !== Prisma.empty) conditions.push(scope);
    if (skillGroup === 'none') conditions.push(Prisma.sql`c.skills_category_id IS NULL`);
    else if (skillGroup) conditions.push(Prisma.sql`c.skills_category_id = ${skillGroup}::uuid`);
    const locationExpr = Prisma.sql`NULLIF(btrim(c.current_location), '')`;
    if (skillGroup && location !== null) {
      conditions.push(location === 'none' ? Prisma.sql`${locationExpr} IS NULL` : Prisma.sql`lower(${locationExpr}) = lower(${location})`);
    }
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    if (!skillGroup) {
      const rows = await prisma.$queryRaw<{ skill_group_id: string | null; skill_group: string | null; count: bigint }[]>`
        SELECT c.skills_category_id AS skill_group_id, sg.name AS skill_group, COUNT(*) AS count
        FROM candidates c
        LEFT JOIN skill_categories sg ON sg.id = c.skills_category_id
        ${where}
        GROUP BY c.skills_category_id, sg.name
        ORDER BY COUNT(*) DESC, sg.name`;
      const groups = rows.map((r) => ({ id: r.skill_group_id ?? 'none', name: r.skill_group ?? 'No skill group', count: Number(r.count) }));
      return NextResponse.json({ level: 'skill_group', today, total: groups.reduce((s, g) => s + g.count, 0), groups });
    }

    const [locations, candidates, group] = await Promise.all([
      prisma.$queryRaw<{ location: string | null; count: bigint }[]>`
        SELECT MIN(${locationExpr}) AS location, COUNT(*) AS count
        FROM candidates c
        ${skillGroup && location !== null ? Prisma.sql`WHERE ${Prisma.join(conditions.slice(0, -1), ' AND ')}` : where}
        GROUP BY lower(${locationExpr})
        ORDER BY COUNT(*) DESC`,
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT c.id, c.full_name, c.current_location, c.current_company, c.current_designation, c.total_experience,
               c.availability, to_char(c.available_from, 'YYYY-MM-DD') AS available_from, c.expected_ctc, c.skills,
               c.offer_in_hand, to_char(c.offer_doj, 'YYYY-MM-DD') AS offer_doj
        FROM candidates c
        ${where}
        ORDER BY (c.availability = 'Immediate') DESC, c.available_from NULLS LAST, c.full_name
        LIMIT ${CANDIDATE_LIMIT}`,
      skillGroup === 'none' ? Promise.resolve(null) : prisma.skill_categories.findUnique({ where: { id: skillGroup }, select: { name: true } }),
    ]);

    return NextResponse.json({
      level: 'location',
      today,
      skill_group: skillGroup === 'none' ? 'No skill group' : group?.name ?? 'Skill group',
      location: location ?? null,
      locations: locations.map((l) => ({ name: l.location ?? 'Not specified', key: l.location ?? 'none', count: Number(l.count) })),
      candidates: candidates.map((c) => ({
        id: c.id as string,
        full_name: c.full_name as string,
        current_location: (c.current_location as string | null) ?? null,
        current_company: (c.current_company as string | null) ?? null,
        current_designation: (c.current_designation as string | null) ?? null,
        total_experience: (c.total_experience as string | null) ?? null,
        availability: (c.availability as string | null) ?? null,
        available_from: (c.available_from as string | null) ?? null,
        expected_ctc: c.expected_ctc === null || c.expected_ctc === undefined ? null : Number(c.expected_ctc),
        skills: (c.skills as string[] | null) ?? [],
        offer_in_hand: !!c.offer_in_hand,
        offer_doj: (c.offer_doj as string | null) ?? null,
      })),
      limited: candidates.length === CANDIDATE_LIMIT,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/reports/ready-to-join:', error);
    return NextResponse.json({ error: 'Failed to load the report' }, { status: 500 });
  }
}
