import path from 'path';
import { storeUpload } from '@/lib/storage/uploadStorage';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canCreateDemand } from '@/lib/auth/demandPermissions';

const MAX_JD_BYTES = 10 * 1024 * 1024;
const ALLOWED_JD_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];

/**
 * POST /api/uploads/jd — stores a Customer JD file and returns its url + original name.
 *
 * Uploaded before the demand is saved (Add Demand has no demand id yet), so the file is not tied
 * to a demand here; the demand write stores the returned url. Gated on demand-write roles, the
 * same people who can create/edit a demand. Stored under a random folder so names never collide
 * and cannot be guessed from the demand.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canCreateDemand(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to upload a Customer JD' }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
    }
    if (file.size > MAX_JD_BYTES) {
      return NextResponse.json({ error: 'Keep the JD file under 10 MB' }, { status: 400 });
    }
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_JD_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: `Upload a ${ALLOWED_JD_EXTENSIONS.join(', ')} file` }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || `jd${extension}`;
    const folder = randomUUID();
    // Disk locally, Netlify Blobs on the live site (uploadStorage.ts).
    const url = await storeUpload(`jd/${folder}/${safeName}`, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      fileName: file.name.slice(0, 255),
    });

    return NextResponse.json({
      url,
      name: file.name.slice(0, 255),
      success: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/uploads/jd:', error);
    return NextResponse.json({ error: 'Failed to upload the JD file' }, { status: 500 });
  }
}
