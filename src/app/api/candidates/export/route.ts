import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildCandidateScopeFilter } from '@/lib/auth/candidatePermissions';
import { canViewDemand } from '@/lib/auth/demandPermissions';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { buildSearchWhere, buildRawIlikeWhere, buildRawSkillOverlapWhere } from '@/lib/search';
import { buildExactMatchWhere } from '@/lib/filter';
import { CANDIDATE_SEARCH_FIELDS, CANDIDATE_SEARCH_ARRAY_FIELDS } from '@/constants/search';
import { CANDIDATE_FILTER_FIELDS } from '@/constants/filters';

const FORBIDDEN_CANDIDATE = 'You do not have permission to access this candidate';

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Full Name', key: 'full_name', width: 25 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Alternate Phone', key: 'alternate_phone', width: 16 },
  { header: 'Current Location', key: 'current_location', width: 20 },
  { header: 'Preferred Location', key: 'preferred_locations', width: 25 },
  { header: 'Current Company', key: 'current_company', width: 22 },
  { header: 'Current Designation', key: 'current_designation', width: 22 },
  { header: 'Total Experience', key: 'total_experience', width: 16 },
  { header: 'Key Skills', key: 'skills', width: 30 },
  { header: 'Qualification', key: 'qualification', width: 18 },
  { header: 'Specialization', key: 'specialization', width: 20 },
  { header: 'Current CTC', key: 'current_ctc', width: 14 },
  { header: 'Expected CTC', key: 'expected_ctc', width: 14 },
  { header: 'Available From', key: 'available_from', width: 16 },
  { header: 'Notice Period', key: 'availability', width: 14 },
  { header: 'Work Mode', key: 'work_mode', width: 14 },
  { header: 'LinkedIn URL', key: 'linked_url', width: 32 },
  { header: 'Source', key: 'source', width: 14 },
  { header: 'Added By', key: 'added_by_name', width: 22 },
  { header: 'Created Date', key: 'created_at', width: 14 },
];

interface ExportCandidateRow {
  full_name: string;
  email: string;
  phone: string;
  alternate_phone: string | null;
  current_location: string | null;
  preferred_locations: string[] | null;
  current_company: string | null;
  current_designation: string | null;
  total_experience: string | null;
  skills: string[] | null;
  qualification: string | null;
  specialization: string | null;
  current_ctc: unknown;
  expected_ctc: unknown;
  available_from: Date | null;
  availability: string | null;
  work_mode: string | null;
  linked_url: string | null;
  source: string;
  created_at: Date;
  profiles_candidates_added_byToprofiles: { full_name: string } | null;
}

function toRow(c: ExportCandidateRow) {
  return {
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    alternate_phone: c.alternate_phone ?? '',
    current_location: c.current_location ?? '',
    preferred_locations: (c.preferred_locations ?? []).join(', '),
    current_company: c.current_company ?? '',
    current_designation: c.current_designation ?? '',
    total_experience: c.total_experience ?? '',
    skills: (c.skills ?? []).join(', '),
    qualification: c.qualification ?? '',
    specialization: c.specialization ?? '',
    current_ctc: c.current_ctc != null ? Number(c.current_ctc) : '',
    expected_ctc: c.expected_ctc != null ? Number(c.expected_ctc) : '',
    available_from: c.available_from ? new Date(c.available_from).toISOString().split('T')[0] : '',
    availability: c.availability ?? '',
    work_mode: c.work_mode ?? '',
    linked_url: c.linked_url ?? '',
    source: c.source,
    added_by_name: c.profiles_candidates_added_byToprofiles?.full_name ?? '',
    created_at: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
  };
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    if (format !== 'xlsx' && format !== 'csv') {
      return NextResponse.json({ error: 'format must be xlsx or csv' }, { status: 400 });
    }

    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const workMode = searchParams.get('workMode') || '';
    const requestId = searchParams.get('requestId') || '';

    // Same filter/visibility conditions as GET /api/candidates (the list endpoint) — an
    // export always reflects exactly what the viewer is currently looking at, scoped to
    // what they're authorized to see. No pagination: every matching row is included.
    const where: Prisma.candidatesWhereInput = {
      ...buildExactMatchWhere<Prisma.candidatesWhereInput>({
        [CANDIDATE_FILTER_FIELDS.source]: source,
        [CANDIDATE_FILTER_FIELDS.workMode]: workMode,
      }),
      profile_archived: { not: true },
    };

    const scopeFilter = await buildCandidateScopeFilter({ role: currentUser.role, id: currentUser.userId });
    // AND-ed so a scope using `OR` can never be replaced by (or replace) the search's `OR`.
    if (scopeFilter) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), scopeFilter];

    if (requestId) {
      const demand = await loadDemandContext(requestId);
      if (!demand) {
        return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
      }
      if (!canViewDemand({ role: currentUser.role, id: currentUser.userId }, demand)) {
        return NextResponse.json({ error: FORBIDDEN_CANDIDATE }, { status: 403 });
      }
      const skillClause = buildRawSkillOverlapWhere('skills', demand.technology_stack);
      const eligibleIds = skillClause !== Prisma.empty
        ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates WHERE ${skillClause}`
        : [];
      where.id = { in: eligibleIds.map((c) => c.id) };
    }

    if (search) {
      const textOr = buildSearchWhere<Prisma.candidatesWhereInput>(search, CANDIDATE_SEARCH_FIELDS) ?? [];
      const skillsClause = buildRawIlikeWhere(search, [], CANDIDATE_SEARCH_ARRAY_FIELDS);
      const skillMatches = skillsClause !== Prisma.empty
        ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM candidates WHERE ${skillsClause}`
        : [];
      where.OR = [
        ...textOr,
        ...(skillMatches.length > 0 ? [{ id: { in: skillMatches.map((c) => c.id) } }] : []),
      ];
    }

    const candidates = await prisma.candidates.findMany({
      where,
      include: {
        profiles_candidates_added_byToprofiles: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Costaff North ATS Engine';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Candidates');
    sheet.columns = COLUMNS;
    candidates.forEach((c) => sheet.addRow(toRow(c as unknown as ExportCandidateRow)));

    const dateStamp = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const buffer = await workbook.csv.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Candidates_Export_${dateStamp}.csv"`,
        },
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Candidates_Export_${dateStamp}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/candidates/export:', error);
    return NextResponse.json({ error: 'Failed to export candidates' }, { status: 500 });
  }
}
