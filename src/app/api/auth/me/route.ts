import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserProfile';

export async function GET() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: profile });
}
