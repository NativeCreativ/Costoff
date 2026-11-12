/**
 * Session cookie flags shared by login and logout.
 *
 * `secure` follows the request that set the cookie, not NODE_ENV. The production
 * image is often published over plain HTTP, and browsers drop a Secure cookie
 * on those responses, which leaves the user stuck on the login page.
 *
 * COOKIE_SECURE=true or false overrides detection. Otherwise the cookie is
 * Secure only for HTTPS, including the first value of x-forwarded-proto so a
 * TLS proxy in front of this HTTP process still gets a Secure cookie.
 */

type CookieRequest = {
  url: string;
  headers: { get(name: string): string | null };
};

export function sessionCookieSecure(request: CookieRequest): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === 'true' || override === '1' || override === 'yes') return true;
  if (override === 'false' || override === '0' || override === 'no') return false;

  const forwarded = request.headers.get('x-forwarded-proto') ?? request.headers.get('X-Forwarded-Proto');
  if (forwarded) {
    const proto = forwarded.split(',')[0]?.trim().toLowerCase();
    if (proto === 'https') return true;
    if (proto === 'http') return false;
  }

  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sessionCookieBase(request: CookieRequest, maxAge: number) {
  return {
    httpOnly: true as const,
    secure: sessionCookieSecure(request),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
