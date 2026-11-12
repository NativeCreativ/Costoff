import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { signSessionToken } from '@/lib/auth/jwt';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import { sessionCookieBase } from '@/lib/auth/sessionCookie';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const profile = await prisma.profiles.findUnique({ where: { email } });

    if (!profile || !profile.password_hash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, profile.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (profile.is_active === false) {
      return NextResponse.json({ error: 'This account has been deactivated' }, { status: 403 });
    }

    const token = await signSessionToken({
      userId: profile.id,
      email: profile.email,
      role: profile.role,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieBase(request, SESSION_COOKIE_MAX_AGE_SECONDS));

    const { password_hash: _omit, ...safeProfile } = profile;

    return NextResponse.json({ profile: safeProfile, success: true });
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    return NextResponse.json({ error: 'Failed to log in' }, { status: 500 });
  }
}
