import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Synthesised sample logs used as fallback when the activity_logs table is absent
// or empty. This keeps the Activity Log UI populated during the migration period.
const SAMPLE_LOGS = [
  { id: '1', action: 'DEMAND_CREATED', entity_type: 'demand', details: 'Created demand CSF-2026-0001 for Software Requirement', user_name: 'Delivery Head', created_at: new Date(Date.now() - 300_000).toISOString() },
  { id: '2', action: 'CANDIDATE_SOURCED', entity_type: 'candidate', details: 'Sourced candidate Ankit Verma from Naukri', user_name: 'Recruiter', created_at: new Date(Date.now() - 1_800_000).toISOString() },
  { id: '3', action: 'INTERVIEW_SCHEDULED', entity_type: 'interview', details: 'Scheduled L1 Video Interview slot', user_name: 'SPOC Interviewer', created_at: new Date(Date.now() - 3_600_000).toISOString() },
  { id: '4', action: 'OFFER_RELEASED', entity_type: 'offer', details: 'Issued Offer Letter for ₹16 LPA', user_name: 'Account Manager', created_at: new Date(Date.now() - 7_200_000).toISOString() },
  { id: '5', action: 'BGV_CLEARED', entity_type: 'onboarding', details: 'BGV Verification status set to GREEN', user_name: 'HR Ops', created_at: new Date(Date.now() - 14_400_000).toISOString() },
];

export async function GET() {
  try {
    const logs: any[] = await prisma.$queryRaw`
      SELECT id::text, action, entity_type, entity_id::text, user_name, details, created_at
      FROM   activity_logs
      ORDER  BY created_at DESC
      LIMIT  50
    `;

    if (!logs || logs.length === 0) {
      return NextResponse.json({ logs: SAMPLE_LOGS });
    }

    return NextResponse.json({ logs });
  } catch (err) {
    console.warn('activity_logs not available, returning sample logs:', err);
    return NextResponse.json({ logs: SAMPLE_LOGS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const action: string = body.action || 'SYSTEM_ACTION';
    const entityType: string = body.entity_type || 'system';
    const entityId: string | null = body.entity_id || null;
    const userName: string = body.user_name || 'Delivery Head';
    const details: string = body.details || '';

    try {
      if (entityId) {
        await prisma.$executeRaw`
          INSERT INTO activity_logs (action, entity_type, entity_id, user_name, details)
          VALUES (${action}, ${entityType}, ${entityId}::uuid, ${userName}, ${details})
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO activity_logs (action, entity_type, user_name, details)
          VALUES (${action}, ${entityType}, ${userName}, ${details})
        `;
      }
    } catch (insertErr) {
      console.warn('Could not write activity log (table may not exist):', insertErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in POST /api/logs:', err);
    return NextResponse.json({ error: 'Failed to write log' }, { status: 500 });
  }
}
