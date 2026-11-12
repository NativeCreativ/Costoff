import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { readUpload } from '@/lib/storage/uploadStorage';

/**
 * GET /api/files/<key> — an uploaded file kept in Netlify Blobs (see uploadStorage.ts).
 * Signed-in users only. Opened in the browser (inline) with its original file name.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    await requireAuth();
    const { key } = await params;
    const file = await readUpload((key ?? []).map(decodeURIComponent).join('/'));
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const safeName = file.fileName.replace(/["\\\r\n]/g, '_');
    return new NextResponse(file.data, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/files:', error);
    return NextResponse.json({ error: 'Failed to load the file' }, { status: 500 });
  }
}
