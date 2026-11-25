import { NextResponse } from 'next/server';

/**
 * POST /api/auth/reset-password — switched off (security fix, 25 Nov 2026).
 *
 * It used to set a new password for whatever email was posted, with no emailed link and no
 * sign-in, so anyone who knew an email address (e.g. the admin's) could take over that account.
 * The app cannot send emails, so there is no safe self-service reset. A forgotten password is
 * reset by the Delivery Head from the Users page (PUT /api/users/[id]/password, super_admin only),
 * and users change their own password there with their current one.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Password reset by email is not available. Ask your Delivery Head to reset your password from the Users page.' },
    { status: 403 }
  );
}
