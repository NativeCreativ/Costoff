import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import ExcelJS from 'exceljs';
import { formatCompensationRange } from '@/lib/utils';

function toNum(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function fmtDate(v: unknown) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v);
}

import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildInterviewReadScope } from '@/lib/auth/interviewPermissions';

export async function GET() {
  try {
    const currentUser = await requireAuth();
    // Rule: Export follows the same central interview visibility scope.
    const interviewScope = buildInterviewReadScope({ role: currentUser.role, id: currentUser.userId });

    const [demands, candidates, interviews, offers, onboardings] = await Promise.all([
      prisma.demands.findMany({
        orderBy: { created_at: 'desc' },
        include: { compensation_currencies: true, compensation_types: true },
      }),
      prisma.candidates.findMany({
        orderBy: { created_at: 'desc' },
        take: 500,
      }),
      prisma.interviews.findMany({
        where: interviewScope,
        orderBy: { created_at: 'desc' },
        include: {
          profiles_interviews_created_byToprofiles: { select: { full_name: true } },
        },
      }),
      prisma.offers.findMany({
        orderBy: { created_at: 'desc' },
      }),
      prisma.onboardings.findMany({
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Costaff North ATS Engine';
    workbook.created = new Date();

    // Sheet 1: Demands
    const demandsSheet = workbook.addWorksheet('Client_Staffing Log');
    demandsSheet.columns = [
      { header: 'Request ID', key: 'request_id', width: 20 },
      { header: 'Client Name', key: 'client_name', width: 25 },
      { header: 'Skill Description', key: 'skill_description', width: 35 },
      { header: 'Role Category', key: 'role_category', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Num Positions', key: 'num_positions', width: 15 },
      { header: 'Compensation', key: 'compensation', width: 28 },
      { header: 'Created Date', key: 'created_at', width: 22 },
    ];
    demands.forEach(d =>
      demandsSheet.addRow({
        ...d,
        // Same shared helper as the UI, so exports match the screen exactly.
        compensation: formatCompensationRange(d.compensation_min, d.compensation_max),
        created_at: fmtDate(d.created_at),
      })
    );

    // Sheet 2: Candidates
    const candidatesSheet = workbook.addWorksheet('TA_Daily Call Log');
    candidatesSheet.columns = [
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Current Company', key: 'current_company', width: 25 },
      { header: 'Location', key: 'current_location', width: 20 },
      { header: 'Current CTC', key: 'current_ctc', width: 15 },
      { header: 'Expected CTC', key: 'expected_ctc', width: 15 },
      { header: 'Source', key: 'source', width: 15 },
    ];
    candidates.forEach(c =>
      candidatesSheet.addRow({
        ...c,
        current_ctc: toNum(c.current_ctc),
        expected_ctc: toNum(c.expected_ctc),
        created_at: fmtDate(c.created_at),
      })
    );

    // Sheet 3: Interviews
    const interviewsSheet = workbook.addWorksheet('Interview Sheet');
    interviewsSheet.columns = [
      { header: 'Level', key: 'level', width: 12 },
      { header: 'Created By', key: 'created_by_name', width: 22 },
      { header: 'Skill Tested', key: 'skill_tested', width: 25 },
      { header: 'Mode', key: 'mode', width: 12 },
      { header: 'Scheduled Date', key: 'scheduled_date', width: 15 },
      { header: 'Scheduled Time', key: 'scheduled_time', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    interviews.forEach(i =>
      interviewsSheet.addRow({
        ...i,
        created_by_name: i.profiles_interviews_created_byToprofiles?.full_name ?? '',
        scheduled_date: fmtDate(i.scheduled_date),
        scheduled_time: i.scheduled_time instanceof Date
          ? i.scheduled_time.toISOString().split('T')[1]?.slice(0, 5)
          : i.scheduled_time,
      })
    );

    // Sheet 4: Offers & Onboarding
    const offersSheet = workbook.addWorksheet('Offers & Onboardings');
    offersSheet.columns = [
      { header: 'Offered CTC', key: 'offered_ctc', width: 15 },
      { header: 'Offer Date', key: 'offer_date', width: 15 },
      { header: 'Offer Status', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    offers.forEach(o =>
      offersSheet.addRow({
        ...o,
        offered_ctc: toNum(o.offered_ctc),
        offer_date: fmtDate(o.offer_date),
      })
    );

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Costaff_Master_Export_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error generating Excel export:', error);
    return NextResponse.json({ error: 'Failed to export Excel file' }, { status: 500 });
  }
}
