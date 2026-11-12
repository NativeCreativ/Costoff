import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { sessionCookieBase } from '@/lib/auth/sessionCookie';

// POST /api/auth/logout — clears the session cookie server-side. Intentionally
// requires no auth: an expired/invalid/already-cleared session must still be able
// to hit this and get a clean 200, so the client can always finish its logout flow.
export async function POST(request: Request) {
  const cookieStore = await cookies();

  // Match the exact attributes used when the cookie was set at login (path/httpOnly/
  // secure/sameSite) — `cookies().delete(name)` alone can silently fail to clear a
  // cookie whose `path` differs from the request's default, so set it to an already-
  // expired cookie with the same path instead of relying on delete-by-name alone.
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...sessionCookieBase(request, 0),
    expires: new Date(0),
  });

  return NextResponse.json({ success: true });
}
