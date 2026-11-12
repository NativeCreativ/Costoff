import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getStore } from '@netlify/blobs';

/**
 * Where uploaded files (Customer JD, onboarding documents) are kept.
 *
 *  - Netlify (UPLOAD_STORAGE=netlify-blobs, set on the site): Netlify Blobs store "uploads".
 *    The serverless file system there is read-only / thrown away after each request, so files
 *    written to disk would vanish. Served back through GET /api/files/<key>, which requires a
 *    signed-in user.
 *  - Everywhere else (local, Docker): public/uploads/<key>, served statically as before, so
 *    existing links keep working.
 */
const BLOB_STORE = 'uploads';
export const BLOB_URL_PREFIX = '/api/files/';

export function usesBlobStorage(): boolean {
  return process.env.UPLOAD_STORAGE === 'netlify-blobs';
}

/** `key` is a relative path like "jd/<uuid>/file.pdf" (letters, digits, . _ - and /). */
export async function storeUpload(key: string, bytes: Buffer, meta: { contentType: string; fileName: string }): Promise<string> {
  if (key.includes('..') || key.startsWith('/')) throw new Error('Invalid upload key');
  if (usesBlobStorage()) {
    const store = getStore({ name: BLOB_STORE, consistency: 'strong' });
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await store.set(key, arrayBuffer, { metadata: { contentType: meta.contentType || 'application/octet-stream', fileName: meta.fileName } });
    return `${BLOB_URL_PREFIX}${key}`;
  }
  const absolute = path.join(process.cwd(), 'public', 'uploads', ...key.split('/'));
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  return `/uploads/${key}`;
}

/** Reads a blob-stored upload for GET /api/files/<key>. Null when missing. */
export async function readUpload(key: string): Promise<{ data: ArrayBuffer; contentType: string; fileName: string } | null> {
  if (!usesBlobStorage() || key.includes('..')) return null;
  const store = getStore({ name: BLOB_STORE, consistency: 'strong' });
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result) return null;
  const meta = (result.metadata ?? {}) as { contentType?: string; fileName?: string };
  return {
    data: result.data,
    contentType: meta.contentType || 'application/octet-stream',
    fileName: meta.fileName || key.split('/').pop() || 'file',
  };
}
