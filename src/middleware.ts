import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { verifySessionToken } from '@/lib/auth/jwt';
import { REQUEST_PATH_HEADER } from '@/lib/auth/requestPath';

const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes do their own auth (requireAuth). They only get the trusted request path, which
  // requireAuth uses for per-employee screen access. Always overwritten, so a caller can't fake it.
  if (pathname.startsWith('/api/')) {
    const headers = new Headers(request.headers);
    headers.set(REQUEST_PATH_HEADER, pathname);
    return NextResponse.next({ request: { headers } });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!session && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isAuthPage) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
