import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, requireRole, AuthError } from '@/lib/auth/session';
import { superAdminSettingsSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import {
  SUPER_ADMIN_SETTINGS_KEYS,
  DEFAULT_RESUME_CAP_PER_POSITION,
  HARDCODED_DEFAULT_INTERVIEW_ROUNDS,
  HARDCODED_DEFAULT_INTERVIEW_MODES,
  normalizeInterviewModes,
  normalizeOnboardingChecklist,
  normalizeBgvChecklist,
} from '@/lib/demandFulfillment/constants';
import type { InterviewRound } from '@/components/types';

// GET /api/admin/settings/demand-fulfillment — resume cap, interview round defaults,
// onboarding document checklist, BGV checklist. Readable by any authenticated role
// (recruiters/SPOCs need the resolved defaults too); writes are Super Admin only.
// `includeInactive=true` (Super Admin only) returns inactive rounds too; the default
// returns ACTIVE items only so existing form pickers stay safe.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    if (includeInactive) {
      await requireRole(['super_admin']);
    }

    const rows = await prisma.super_admin_settings.findMany({
      where: { key: { in: Object.values(SUPER_ADMIN_SETTINGS_KEYS) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    // Both lists below are read-only now: there is no admin UI or write endpoint left to change
    // them (see the Demand Fulfillment Settings "Default interview rounds" / "Interview modes"
    // removal). They stay in this response because other things still read them at runtime —
    // `interview_rounds_default` seeds the round configurator's global suggestion chips
    // (Demand/Company forms), and `interview_mode_options` is resolveInterviewModes()'s source
    // for validating an interview's `mode` when scheduling.
    const interviewRoundsDefault = (byKey.get(SUPER_ADMIN_SETTINGS_KEYS.interviewRoundsDefault) ??
      HARDCODED_DEFAULT_INTERVIEW_ROUNDS) as unknown as InterviewRound[];

    const filteredRounds = includeInactive
      ? interviewRoundsDefault
      : interviewRoundsDefault.filter((r) => r.isActive !== false);

    return NextResponse.json({
      resume_cap_per_position: byKey.get(SUPER_ADMIN_SETTINGS_KEYS.resumeCapPerPosition) ?? DEFAULT_RESUME_CAP_PER_POSITION,
      interview_rounds_default: filteredRounds,
      interview_mode_options: normalizeInterviewModes(byKey.get(SUPER_ADMIN_SETTINGS_KEYS.interviewModeOptions) ?? HARDCODED_DEFAULT_INTERVIEW_MODES),
      onboarding_document_checklist: normalizeOnboardingChecklist(byKey.get(SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist) ?? []),
      bgv_checklist: normalizeBgvChecklist(byKey.get(SUPER_ADMIN_SETTINGS_KEYS.bgvChecklist) ?? []),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/admin/settings/demand-fulfillment:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings/demand-fulfillment — Super Admin only. Accepts a PARTIAL body: the
// settings page saves one field per user action (resume cap on blur/Enter; checklists on add,
// rename, delete, reorder or a Mandatory/Required toggle), so a caller sends only the one key it
// changed. An unsent key is left untouched — never defaulted or cleared. `interview_rounds_default`
// / `interview_mode_options` are not settable here any more — there is no admin UI left for them.
export async function PUT(request: Request) {
  try {
    const currentUser = await requireRole(['super_admin']);
    const body = await request.json();
    const parsed = superAdminSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const values = parsed.data;

    const upserts: ReturnType<typeof prisma.super_admin_settings.upsert>[] = [];
    const upsertField = (key: string, value: unknown) => {
      upserts.push(
        prisma.super_admin_settings.upsert({
          where: { key },
          update: { value: value as any, updated_by: currentUser.userId },
          create: { key, value: value as any, updated_by: currentUser.userId },
        })
      );
    };

    if (values.resume_cap_per_position !== undefined) upsertField(SUPER_ADMIN_SETTINGS_KEYS.resumeCapPerPosition, values.resume_cap_per_position);
    if (values.onboarding_document_checklist !== undefined) upsertField(SUPER_ADMIN_SETTINGS_KEYS.onboardingDocumentChecklist, values.onboarding_document_checklist);
    if (values.bgv_checklist !== undefined) upsertField(SUPER_ADMIN_SETTINGS_KEYS.bgvChecklist, values.bgv_checklist);

    await prisma.$transaction(upserts);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/demand-fulfillment:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
