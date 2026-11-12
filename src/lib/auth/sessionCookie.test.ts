import { afterEach, describe, expect, it } from 'vitest';
import { sessionCookieSecure } from './sessionCookie';

const env = process.env as Record<string, string | undefined>;
const ORIGINAL = env.COOKIE_SECURE;
const ORIGINAL_NODE_ENV = env.NODE_ENV;

function request(url: string, forwardedProto?: string) {
  const headers = new Headers();
  if (forwardedProto !== undefined) headers.set('x-forwarded-proto', forwardedProto);
  return { url, headers };
}

afterEach(() => {
  if (ORIGINAL === undefined) delete env.COOKIE_SECURE;
  else env.COOKIE_SECURE = ORIGINAL;
  if (ORIGINAL_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('sessionCookieSecure', () => {
  it('is not Secure for a plain HTTP request, even when NODE_ENV is production', () => {
    delete env.COOKIE_SECURE;
    env.NODE_ENV = 'production';
    expect(sessionCookieSecure(request('http://15.207.246.4/api/auth/login'))).toBe(false);
  });

  it('is Secure for an HTTPS request', () => {
    delete env.COOKIE_SECURE;
    expect(sessionCookieSecure(request('https://ats.example.com/api/auth/login'))).toBe(true);
  });

  it('trusts the first x-forwarded-proto value over the local URL', () => {
    delete env.COOKIE_SECURE;
    expect(sessionCookieSecure(request('http://127.0.0.1:3000/api/auth/login', 'https'))).toBe(true);
    expect(sessionCookieSecure(request('http://127.0.0.1:3000/api/auth/login', 'HTTPS, http'))).toBe(true);
    expect(sessionCookieSecure(request('https://ats.example.com/api/auth/login', 'http'))).toBe(false);
  });

  it('lets COOKIE_SECURE force the flag either way', () => {
    env.COOKIE_SECURE = 'false';
    expect(sessionCookieSecure(request('https://ats.example.com/api/auth/login', 'https'))).toBe(false);
    env.COOKIE_SECURE = 'true';
    expect(sessionCookieSecure(request('http://15.207.246.4/api/auth/login'))).toBe(true);
    env.COOKIE_SECURE = '0';
    expect(sessionCookieSecure(request('https://ats.example.com/api/auth/login'))).toBe(false);
  });
});
