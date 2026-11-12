import { prisma } from '@/lib/db/prisma';

export interface ClosurePendingOnboarding {
  onboardingId: string;
  demandId: string | null;
  candidateName: string | null;
  demandRequestId: string | null;
  closureDueAt: Date | null;
}

/**
 * Finds onboarding rows whose closure_due_at (joined_at + 90 days, maintained by the
 * onboardings_set_closure_due_at DB trigger) has passed and that have not yet been
 * closed. Does NOT auto-close anything — per the spec, the AM must fill closure_feedback
 * and confirm; this only flags candidates as "Closure Pending Feedback".
 */
export async function findClosurePendingOnboardings(): Promise<ClosurePendingOnboarding[]> {
  const rows = await prisma.onboardings.findMany({
    where: {
      closed_at: null,
      closure_due_at: { lte: new Date() },
    },
    include: {
      candidates: { select: { full_name: true } },
      demands: { select: { id: true, request_id: true } },
    },
    orderBy: { closure_due_at: 'asc' },
  });

  return rows.map((r) => ({
    onboardingId: r.id,
    demandId: r.demands?.id ?? r.demand_id ?? null,
    candidateName: r.candidates?.full_name ?? null,
    demandRequestId: r.demands?.request_id ?? null,
    closureDueAt: r.closure_due_at,
  }));
}

/**
 * Entry point for the daily scheduled job. Currently just resolves the pending list
 * (consumed by the "Closure Pending Feedback" banner on the demand detail page via
 * GET /api/demands/[id] -> onboardings). Logs a summary; wire into whatever
 * scheduler the project adopts (see scripts/closureCron.ts for the runnable form).
 */
export async function runClosureDueCheck(): Promise<{ pendingCount: number; items: ClosurePendingOnboarding[] }> {
  const items = await findClosurePendingOnboardings();
  if (items.length > 0) {
    console.log(`[closure-cron] ${items.length} onboarding(s) past their 90-day closure due date, pending AM feedback:`);
    for (const item of items) {
      console.log(`  - ${item.demandRequestId ?? item.demandId ?? 'unknown demand'} / ${item.candidateName ?? 'unknown candidate'} (due ${item.closureDueAt?.toISOString()})`);
    }
  }
  return { pendingCount: items.length, items };
}
