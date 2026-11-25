import { NextResponse } from 'next/server';

/**
 * POST /api/auth/forgot-password — switched off with the reset route (security fix, 25 Nov 2026).
 * It only told the caller whether an email had an active account, which helped someone guess
 * accounts to take over. Passwords are reset by the Delivery Head from the Users page.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Password reset by email is not available. Ask your Delivery Head to reset your password from the Users page.' },
    { status: 403 }
  );
}
