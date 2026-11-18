import path from 'path';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { storeUpload } from '@/lib/storage/uploadStorage';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canWriteCandidates } from '@/lib/auth/recordPermissions';

const MAX_BYTES = 10 * 1024 * 1024;
/** kind → allowed extensions. Resume and RTR are documents; the photo is an image. */
const ALLOWED: Record<string, string[]> = {
  resume: ['.pdf', '.doc', '.docx', '.rtf', '.txt'],
  rtr: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.eml', '.msg'],
  photo: ['.jpg', '.jpeg', '.png', '.webp'],
};

/**
 * POST /api/uploads/candidate-file (multipart: file, kind=resume|photo|rtr) — stores a candidate
 * file and returns its url + original name. Like the JD upload, it runs before the candidate is
 * saved, so it is not tied to a candidate here; the candidate write stores the url (and only
 * accepts urls under the candidates/ prefix — isCandidateFileUrl).
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    if (!canWriteCandidates(currentUser.role)) {
      return NextResponse.json({ error: 'You do not have permission to upload candidate files' }, { status: 403 });
    }
    const form = await request.formData();
    const kind = String(form.get('kind') || '');
    const allowed = ALLOWED[kind];
    if (!allowed) return NextResponse.json({ error: 'Unknown file type' }, { status: 400 });
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Keep the file under 10 MB' }, { status: 400 });
    const extension = path.extname(file.name).toLowerCase();
    if (!allowed.includes(extension)) {
      return NextResponse.json({ error: `Upload a ${allowed.join(', ')} file` }, { status: 400 });
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || `${kind}${extension}`;
    const url = await storeUpload(`candidates/${kind}/${randomUUID()}/${safeName}`, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      fileName: file.name.slice(0, 255),
    });
    return NextResponse.json({ url, name: file.name.slice(0, 255), success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/uploads/candidate-file:', error);
    return NextResponse.json({ error: 'Failed to upload the file' }, { status: 500 });
  }
}
