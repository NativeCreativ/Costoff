import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireRole, AuthError } from '@/lib/auth/session';
import { DEMAND_WRITE_ROLES } from '@/lib/auth/demandPermissions';
import { DEMAND_IMPORT_FIELDS } from '@/constants/demandImportFields';

export async function GET(request: Request) {
  try {
    await requireRole(DEMAND_WRITE_ROLES);
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    if (format !== 'xlsx' && format !== 'csv') {
      return NextResponse.json({ error: 'format must be xlsx or csv' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Costaff North ATS Engine';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Demands');
    sheet.columns = DEMAND_IMPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: Math.max(18, f.label.length + 4) }));
    sheet.addRow(Object.fromEntries(DEMAND_IMPORT_FIELDS.map((f) => [f.key, f.example])));

    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const buffer = await workbook.csv.writeBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Demand_Import_Template_${dateStamp}.csv"`,
        },
      });
    }

    // xlsx only: a second "Field Guide" sheet with required/optional + valid-value hints
    // — not representable in a single-sheet CSV, so CSV gets the plain template only.
    const guideSheet = workbook.addWorksheet('Field Guide');
    guideSheet.columns = [
      { header: 'Column', key: 'label', width: 24 },
      { header: 'Required?', key: 'required', width: 12 },
      { header: 'Notes', key: 'hint', width: 60 },
    ];
    DEMAND_IMPORT_FIELDS.forEach((f) => guideSheet.addRow({ label: f.label, required: f.required ? 'Required' : 'Optional', hint: f.hint || '' }));

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Demand_Import_Template_${dateStamp}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/demands/import-template:', error);
    return NextResponse.json({ error: 'Failed to generate import template' }, { status: 500 });
  }
}
