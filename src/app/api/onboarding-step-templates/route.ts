import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSuperAdminSettings } from '@/lib/auth/demandFulfillmentPermissions';
import { onboardingStepTemplateListSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { normalizeTemplateSteps } from '@/lib/onboarding/onboardingSteps';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?companyId=default` (or missing) is the default list; otherwise a company id. */
function parseCompanyId(raw: string | null): string | null | 'invalid' {
  if (!raw || raw === 'default') return null;
  return UUID_RE.test(raw) ? raw : 'invalid';
}

/**
 * GET /api/onboarding-step-templates?companyId= — one ordered step list, inactive steps
 * included (this is the settings editor's read). `has_own_list: false` for a client means its
 * onboardings use the default list. Super Admin, like the rest of Demand Fulfillment Settings.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSuperAdminSettings(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const companyId = parseCompanyId(new URL(request.url).searchParams.get('companyId'));
    if (companyId === 'invalid') return NextResponse.json({ error: 'Unknown client' }, { status: 400 });

    const steps = await prisma.onboarding_step_templates.findMany({
      where: { company_id: companyId },
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, details: true, requires_attachment: true, is_active: true, sort_order: true },
    });
    return NextResponse.json({ steps, has_own_list: companyId === null || steps.length > 0 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/onboarding-step-templates:', error);
    return NextResponse.json({ error: 'Failed to load onboarding steps' }, { status: 500 });
  }
}

/**
 * PUT /api/onboarding-step-templates — saves one complete ordered list (the editor sends it on
 * every add / edit / remove / reorder / toggle). Rows are matched by id so a rename keeps the
 * same step. Removing a step never touches onboardings already in progress: they hold their own
 * copy (onboarding_steps), whose template link is simply cleared. An empty list for a client
 * means "use the default list" again.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    if (!canManageSuperAdminSettings(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = onboardingStepTemplateListSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const companyId = parsed.data.company_id;
    if (companyId) {
      const company = await prisma.companies.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const normalized = normalizeTemplateSteps(parsed.data.steps);
    if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 400 });

    const steps = await prisma.$transaction(async (tx) => {
      const existing = await tx.onboarding_step_templates.findMany({ where: { company_id: companyId }, select: { id: true } });
      const existingIds = new Set(existing.map((row) => row.id));
      const keptIds = new Set<string>();
      for (const [index, step] of normalized.steps.entries()) {
        const data = {
          name: step.name,
          details: step.details,
          requires_attachment: step.requires_attachment,
          is_active: step.is_active,
          sort_order: index,
        };
        if (step.id && existingIds.has(step.id)) {
          await tx.onboarding_step_templates.update({ where: { id: step.id }, data });
          keptIds.add(step.id);
        } else {
          await tx.onboarding_step_templates.create({ data: { ...data, company_id: companyId } });
        }
      }
      const removed = [...existingIds].filter((stepId) => !keptIds.has(stepId));
      if (removed.length > 0) await tx.onboarding_step_templates.deleteMany({ where: { id: { in: removed } } });
      return tx.onboarding_step_templates.findMany({
        where: { company_id: companyId },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, details: true, requires_attachment: true, is_active: true, sort_order: true },
      });
    });

    return NextResponse.json({ steps, has_own_list: companyId === null || steps.length > 0, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/onboarding-step-templates:', error);
    return NextResponse.json({ error: 'Failed to save onboarding steps' }, { status: 500 });
  }
}
