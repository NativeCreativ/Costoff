import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildRawIlikeWhere } from '@/lib/search';
import { buildRawExactMatchWhere } from '@/lib/filter';
import { DEMAND_SEARCH_TEXT_FIELDS, DEMAND_SEARCH_ARRAY_FIELDS } from '@/constants/search';
import { DEMAND_FILTER_FIELDS } from '@/constants/filters';
import { buildDemandVisibilityCondition, buildAssignedToMeCondition } from '@/lib/auth/demandVisibility';
import { formatWorkModes } from '@/components/demands/demand.schema';
import { DEMANDS_WITH_AGING_BASE } from '@/lib/demands/demandAgingQuery';
import { formatCompensationRange } from '@/lib/utils';

interface ExportDemandRow {
  request_id: string;
  client_name: string | null;
  company_name: string | null;
  company_email: string | null;
  job_title: string | null;
  skill_description: string | null;
  technology_stack: string[] | null;
  role_category: string | null;
  experience_levels: string[] | null;
  work_mode: string | null;
  work_modes: string[] | null;
  compensation_currency_code: string | null;
  compensation_type_name: string | null;
  compensation_min: string | number | null;
  compensation_max: string | number | null;
  num_positions: number | null;
  status: string | null;
  priority: string | null;
  locations: string[] | null;
  am_name: string | null;
  spoc_name: string | null;
  recruiter_names: string[] | null;
  days_open: number | null;
  is_red_flag: boolean | null;
  created_at: Date | string | null;
}

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Request ID', key: 'request_id', width: 20 },
  { header: 'Client', key: 'client_name', width: 22 },
  { header: 'Company', key: 'company_name', width: 25 },
  { header: 'Company Email', key: 'company_email', width: 28 },
  { header: 'Job Title', key: 'job_title', width: 28 },
  { header: 'Job Summary', key: 'skill_description', width: 40 },
  { header: 'Required Skills', key: 'required_skills', width: 30 },
  { header: 'Employment Type', key: 'role_category', width: 16 },
  { header: 'Experience Level', key: 'experience_levels', width: 18 },
  { header: 'Work Mode', key: 'work_mode', width: 14 },
  { header: 'Currency', key: 'currency', width: 10 },
  { header: 'Compensation Type', key: 'compensation_type', width: 16 },
  { header: 'Compensation', key: 'compensation', width: 22 },
  { header: 'Positions', key: 'num_positions', width: 10 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Priority', key: 'priority', width: 10 },
  { header: 'Locations', key: 'locations', width: 25 },
  { header: 'Account Manager', key: 'am_name', width: 22 },
  { header: 'SPOC', key: 'spoc_name', width: 22 },
  { header: 'Recruiter(s)', key: 'recruiters', width: 30 },
  { header: 'Days Open', key: 'days_open', width: 10 },
  { header: 'Red Flag', key: 'red_flag', width: 10 },
  { header: 'Created Date', key: 'created_at', width: 14 },
];

function toRow(d: ExportDemandRow) {
  return {
    request_id: d.request_id,
    client_name: d.client_name ?? '',
    company_name: d.company_name ?? '',
    company_email: d.company_email ?? '',
    job_title: d.job_title ?? '',
    skill_description: d.skill_description ?? '',
    required_skills: (d.technology_stack ?? []).join(', '),
    role_category: d.role_category ?? '',
    experience_levels: (d.experience_levels ?? []).join(', '),
    work_mode: formatWorkModes(d),
    currency: d.compensation_currency_code ?? '',
    compensation_type: d.compensation_type_name ?? '',
    // One range cell, built by the shared helper so the export matches the screen.
    compensation: formatCompensationRange(d.compensation_min, d.compensation_max),
    num_positions: d.num_positions ?? '',
    status: d.status ?? '',
    priority: d.priority ?? '',
    locations: (d.locations ?? []).join(', '),
    am_name: d.am_name ?? '',
    spoc_name: d.spoc_name ?? '',
    recruiters: (d.recruiter_names ?? []).join(', '),
    days_open: d.days_open ?? '',
    red_flag: d.is_red_flag ? 'Yes' : 'No',
    created_at: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '',
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
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const roleType = searchParams.get('roleType') || '';
    const redFlagsOnly = searchParams.get('redFlagsOnly') === 'true';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';

    // Same filter/visibility conditions as GET /api/demands (the list endpoint) — an
    // export always reflects exactly what the viewer is currently looking at, scoped to
    // what they're authorized to see. No pagination: every matching row is included.
    const conditions: Prisma.Sql[] = [
      ...buildRawExactMatchWhere({
        [DEMAND_FILTER_FIELDS.status]: status,
        [DEMAND_FILTER_FIELDS.priority]: priority,
        [DEMAND_FILTER_FIELDS.roleType]: roleType,
      }),
    ];
    const visibilityCondition = buildDemandVisibilityCondition(currentUser);
    if (visibilityCondition) conditions.push(visibilityCondition);
    const assignedCondition = assignedToMe ? buildAssignedToMeCondition(currentUser) : null;
    if (assignedCondition) conditions.push(assignedCondition);
    if (redFlagsOnly) conditions.push(Prisma.sql`is_red_flag = true`);
    const searchClause = buildRawIlikeWhere(search, DEMAND_SEARCH_TEXT_FIELDS, DEMAND_SEARCH_ARRAY_FIELDS);
    if (searchClause !== Prisma.empty) conditions.push(searchClause);

    const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const demands = await prisma.$queryRaw<ExportDemandRow[]>`
      SELECT * FROM (${DEMANDS_WITH_AGING_BASE}) v
      ${whereClause}
      ORDER BY opened_at DESC
    `;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Costaff North ATS Engine';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Demands');
    sheet.columns = COLUMNS;
    demands.forEach((d) => sheet.addRow(toRow(d)));

    const dateStamp = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const buffer = await workbook.csv.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Demands_Export_${dateStamp}.csv"`,
        },
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Demands_Export_${dateStamp}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/export:', error);
    return NextResponse.json({ error: 'Failed to export demands' }, { status: 500 });
  }
}
