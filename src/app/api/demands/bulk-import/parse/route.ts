import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/session';
import { DEMAND_WRITE_ROLES } from '@/lib/auth/demandPermissions';
import { parseWorkbookBuffer, guessMapping, MAX_IMPORT_FILE_BYTES } from '@/lib/demands/demandImportService';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export async function POST(request: Request) {
  try {
    await requireRole(DEMAND_WRITE_ROLES);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file was uploaded' }, { status: 400 });
    }
    const lowerName = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return NextResponse.json({ error: 'Only .xlsx, .xls and .csv files are supported' }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: `File is too large (max ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)}MB)` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows, totalRows, truncated } = parseWorkbookBuffer(buffer);
    if (headers.length === 0) {
      return NextResponse.json({ error: 'The uploaded file has no header row / is empty' }, { status: 400 });
    }

    const mapping = guessMapping(headers);

    return NextResponse.json({ headers, rows, totalRows, truncated, mapping });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/bulk-import/parse:', error);
    return NextResponse.json({ error: 'Failed to parse the uploaded file. Confirm it is a valid .xlsx, .xls or .csv file.' }, { status: 400 });
  }
}
