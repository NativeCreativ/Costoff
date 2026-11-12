import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/session';
import { COMPANY_WRITE_ROLES } from '@/lib/auth/companyPermissions';
import { guessCompanyMapping } from '@/lib/companies/companyImportService';
import { parseWorkbookBuffer, validateImportUpload } from '@/lib/bulk/workbook';

/**
 * POST /api/companies/bulk-import/parse — reads an uploaded workbook and returns its headers,
 * rows and a best-guess column mapping. Same contract as the Demand import parse, so the shared
 * import modal can drive both.
 */
export async function POST(request: Request) {
  try {
    await requireRole(COMPANY_WRITE_ROLES);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file was uploaded' }, { status: 400 });
    }
    const uploadError = validateImportUpload(file);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows, totalRows, truncated } = parseWorkbookBuffer(buffer);
    if (headers.length === 0) {
      return NextResponse.json({ error: 'The uploaded file has no header row / is empty' }, { status: 400 });
    }

    const mapping = guessCompanyMapping(headers);

    return NextResponse.json({ headers, rows, totalRows, truncated, mapping });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/companies/bulk-import/parse:', error);
    return NextResponse.json({ error: 'Failed to parse the uploaded file. Confirm it is a valid .xlsx, .xls or .csv file.' }, { status: 400 });
  }
}