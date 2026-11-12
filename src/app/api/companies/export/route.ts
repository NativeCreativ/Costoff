import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthError } from '@/lib/auth/session';
import { COMPANY_WRITE_ROLES } from '@/lib/auth/companyPermissions';
import { COMPANY_STATUS_VALUES } from '@/components/companies/company.schema';
import { buildSearchWhere } from '@/lib/search';
import { COMPANY_SEARCH_FIELDS } from '@/lib/companies/companyMaster';
import { companyStatusDisplay } from '@/constants/companyImportFields';

interface ExportCompanyRow {
  id: string;
  name: string;
  client_name: string | null;
  status: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  account_manager_email: string | null;
  managed_by_name: string | null;
  rounds: string | null;
  demands_count: number | null;
  created_at: Date | string | null;
}

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Client Name', key: 'name', width: 25 },
  { header: 'Legacy Client Label', key: 'client_name', width: 22 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 18 },
  { header: 'Website', key: 'website', width: 26 },
  { header: 'Address', key: 'address', width: 28 },
  { header: 'City', key: 'city', width: 16 },
  { header: 'State', key: 'state', width: 16 },
  { header: 'Country', key: 'country', width: 16 },
  { header: 'Account Manager', key: 'account_manager_email', width: 26 },
      { header: 'Managed By', key: 'managed_by_name', width: 26 },
  { header: 'Interview Rounds', key: 'rounds', width: 26 },
  { header: 'Linked Demands', key: 'demands_count', width: 14 },
  { header: 'Created Date', key: 'created_at', width: 14 },
];

/** SCREAMING enum in the store, Title Case in the file — matching the import template, so an
 *  exported workbook can be re-imported unchanged. */
const statusLabel = companyStatusDisplay;

function toRow(c: ExportCompanyRow) {
  return {
    name: c.name,
    client_name: c.client_name ?? '',
    status: statusLabel(c.status),
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    country: c.country ?? '',
    account_manager_email: c.account_manager_email ?? '',
    rounds: c.rounds ?? '',
    demands_count: c.demands_count ?? 0,
    created_at: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
  };
}

/**
 * GET /api/companies/export — the Company list as a workbook.
 *
 * Same filter conditions as GET /api/companies (the list endpoint), so an export always
 * reflects exactly what the viewer is currently looking at. No pagination: every matching row
 * is included.
 */
export async function GET(request: Request) {
  try {
    await requireRole(COMPANY_WRITE_ROLES);
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    if (format !== 'xlsx' && format !== 'csv') {
      return NextResponse.json({ error: 'format must be xlsx or csv' }, { status: 400 });
    }

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Prisma.companiesWhereInput = {};
    if (status && (COMPANY_STATUS_VALUES as readonly string[]).includes(status)) {
      where.status = status;
    }
    const searchOr = buildSearchWhere<Prisma.companiesWhereInput>(search, COMPANY_SEARCH_FIELDS);
    if (searchOr) where.OR = searchOr;

    const companies = await prisma.companies.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        profiles_companies_account_managerToprofiles: { select: { email: true, full_name: true, role: true } },
        profiles_companies_managed_byToprofiles: { select: { id: true, full_name: true, email: true } },
        company_interview_rounds: { include: { interview_rounds: { select: { name: true } } }, orderBy: { round_order: 'asc' } },
        _count: { select: { demands: true } },
      },
    });

    // Same "Round|Mode|mandatory" cell format the import template/parser use, so an exported
    // workbook can be re-imported unchanged. Mode is omitted (not `||`) when unset.
    const roundsCell = (rounds: typeof companies[number]['company_interview_rounds']) =>
      rounds
        .map((r) => {
          const name = r.interview_rounds?.name;
          if (!name) return null;
          const parts = [name, r.mode ?? ''];
          if (r.mandatory) parts.push('mandatory');
          // Trailing empty Mode is dropped rather than kept as "Name|" when there is no
          // mandatory flag either, so a round with no mode/mandatory still exports as plain "Name".
          while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
          return parts.join('|');
        })
        .filter((v): v is string => !!v)
        .join(', ');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Costaff North ATS Engine';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Companies');
    sheet.columns = COLUMNS;
    companies.forEach((c) =>
      sheet.addRow(
        toRow({
          name: c.name,
          client_name: c.client_name,
          status: c.status,
          email: c.email,
          phone: c.phone,
          website: c.website,
          address: c.address,
          city: c.city,
          state: c.state,
          country: c.country,
          account_manager_email: c.profiles_companies_account_managerToprofiles?.role === 'account_manager' ? c.profiles_companies_account_managerToprofiles.email : null,
      managed_by_name: c.profiles_companies_managed_byToprofiles?.full_name ?? null,
          id: c.id,
          rounds: roundsCell(c.company_interview_rounds),
          demands_count: c._count.demands,
          created_at: c.created_at,
        })
      )
    );

    const dateStamp = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const buffer = await workbook.csv.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Companies_Export_${dateStamp}.csv"`,
        },
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Companies_Export_${dateStamp}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/companies/export:', error);
    return NextResponse.json({ error: 'Failed to export companies' }, { status: 500 });
  }
}