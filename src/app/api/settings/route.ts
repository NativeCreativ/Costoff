import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const dropdowns = await prisma.dropdown_masters.findMany({
      where: category ? { category, is_active: true } : undefined,
      orderBy: { sort_order: 'asc' },
    });

    return NextResponse.json({
      slaConfig: {
        redFlagDaysThreshold: 30,
        intakeToAllocationSlaDays: 2,
        submissionToClientSlaDays: 1,
        autoArchiveDays: 90
      },
      idScheme: {
        demandPrefix: 'CSF',
        yearFormat: 'YYYY',
        sequenceLength: 4,
        exampleId: 'CSF-2026-0001'
      },
      dropdowns: dropdowns || []
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/settings:', error);
    return NextResponse.json({
      slaConfig: { redFlagDaysThreshold: 30, intakeToAllocationSlaDays: 2, submissionToClientSlaDays: 1, autoArchiveDays: 90 },
      idScheme: { demandPrefix: 'CSF', yearFormat: 'YYYY', sequenceLength: 4, exampleId: 'CSF-2026-0001' },
      dropdowns: []
    }, { status: 500 });
  }
}
