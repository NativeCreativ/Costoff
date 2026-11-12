import type { Prisma } from '@/generated/prisma/client';

/** onboarding_steps.status. Order is guidance only: any step can move to any status. */
export const ONBOARDING_STEP_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'not_applicable'] as const;
export type OnboardingStepStatus = (typeof ONBOARDING_STEP_STATUS_VALUES)[number];

export const ONBOARDING_STEP_STATUS_LABELS: Record<OnboardingStepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  not_applicable: 'Not applicable',
};

/** A step counts as done for progress ("3 of 6 done") and the Mark Joined warning. */
export function isOnboardingStepDone(status: string): boolean {
  return status === 'completed' || status === 'not_applicable';
}

/** Where the onboarding step files live: public/uploads/onboarding/<onboardingId>/steps/. */
export const ONBOARDING_STEP_UPLOAD_DIR = ['uploads', 'onboarding'] as const;

type Db = Prisma.TransactionClient;

/**
 * The step list a client's onboardings start from: the client's own ACTIVE steps when it has
 * any, otherwise the default list (company_id NULL). Inactive steps are skipped either way.
 */
export async function resolveOnboardingTemplate(db: Db, companyId: string | null) {
  if (companyId) {
    const own = await db.onboarding_step_templates.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { sort_order: 'asc' },
    });
    if (own.length > 0) return own;
  }
  return db.onboarding_step_templates.findMany({
    where: { company_id: null, is_active: true },
    orderBy: { sort_order: 'asc' },
  });
}

interface LegacyDocument {
  name?: string;
  received?: boolean;
  url?: string | null;
}

/**
 * Copies the client's step list onto an onboarding the first time it is opened. A no-op once
 * the onboarding has steps, so later template edits never rewrite one already in progress.
 *
 * Onboardings that predate steps keep what their old document checklist recorded: a received
 * document marks the step of the same name Completed (with its file), and a received document
 * with no matching step is appended as its own Completed step, so nothing is lost.
 */
export async function ensureOnboardingSteps(db: Db, onboardingId: string): Promise<void> {
  const existing = await db.onboarding_steps.count({ where: { onboarding_id: onboardingId } });
  if (existing > 0) return;

  const onboarding = await db.onboardings.findUnique({
    where: { id: onboardingId },
    select: { documents_status: true, demands: { select: { company_id: true } } },
  });
  if (!onboarding) return;

  const template = await resolveOnboardingTemplate(db, onboarding.demands?.company_id ?? null);
  const legacy = (Array.isArray(onboarding.documents_status) ? onboarding.documents_status : []) as LegacyDocument[];
  const legacyByName = new Map(
    legacy.filter((doc) => doc?.name).map((doc) => [doc.name!.trim().toLowerCase(), doc] as const)
  );

  const rows: Prisma.onboarding_stepsCreateManyInput[] = template.map((step, index) => {
    const doc = legacyByName.get(step.name.trim().toLowerCase());
    legacyByName.delete(step.name.trim().toLowerCase());
    const received = !!doc?.received;
    return {
      onboarding_id: onboardingId,
      template_step_id: step.id,
      name: step.name,
      details: step.details,
      requires_attachment: step.requires_attachment,
      step_order: index + 1,
      status: received ? 'completed' : 'pending',
      attachment_url: doc?.url || null,
      attachment_name: doc?.url ? step.name : null,
      completed_at: received ? new Date() : null,
    };
  });
  for (const doc of legacyByName.values()) {
    if (!doc.received) continue;
    rows.push({
      onboarding_id: onboardingId,
      template_step_id: null,
      name: doc.name!.trim().slice(0, 150),
      requires_attachment: true,
      step_order: rows.length + 1,
      status: 'completed',
      attachment_url: doc.url || null,
      attachment_name: doc.url ? doc.name!.trim().slice(0, 255) : null,
      completed_at: new Date(),
    });
  }
  if (rows.length > 0) await db.onboarding_steps.createMany({ data: rows });
}

/** Trims and validates a client's step list before saving it (settings editor). */
export function normalizeTemplateSteps(
  steps: { id?: string | null; name: string; details?: string | null; requires_attachment?: boolean; is_active?: boolean }[]
): { ok: true; steps: { id: string | null; name: string; details: string | null; requires_attachment: boolean; is_active: boolean }[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const out = [];
  for (const step of steps) {
    const name = step.name.trim();
    if (!name) return { ok: false, error: 'Every step needs a name' };
    if (name.length > 150) return { ok: false, error: 'Keep step names to 150 characters or fewer' };
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `"${name}" is already in this list` };
    seen.add(key);
    out.push({
      id: step.id || null,
      name,
      details: step.details?.trim() || null,
      requires_attachment: !!step.requires_attachment,
      is_active: step.is_active !== false,
    });
  }
  return { ok: true, steps: out };
}
