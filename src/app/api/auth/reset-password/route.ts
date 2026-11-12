import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { forgotPasswordSchema, resetPasswordSchema } from '@/components/auth/auth.schema';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const emailParsed = forgotPasswordSchema.safeParse({ email: body?.email });
    const passwordParsed = resetPasswordSchema.safeParse(body);
    if (!emailParsed.success || !passwordParsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: {
            ...emailParsed.error?.flatten(),
            ...passwordParsed.error?.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findUnique({
      where: { email: emailParsed.data.email },
      select: { id: true, is_active: true },
    });

    if (!profile || profile.is_active === false) {
      return NextResponse.json({ error: 'No account found with this email address' }, { status: 404 });
    }

    const password_hash = await hashPassword(passwordParsed.data.newPassword);
    await prisma.profiles.update({ where: { id: profile.id }, data: { password_hash } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/auth/reset-password:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
