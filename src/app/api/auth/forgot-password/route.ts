import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { forgotPasswordSchema } from '@/components/auth/auth.schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const profile = await prisma.profiles.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, is_active: true },
    });

    if (!profile || profile.is_active === false) {
      return NextResponse.json({ error: 'No account found with this email address' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/auth/forgot-password:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
