/**
 * Daily closure-due check. Run via `npm run closure-cron`, or wire into whatever
 * scheduler the deployment uses (cron, a platform's scheduled task/serverless cron,
 * or pg_cron calling out to an HTTP endpoint). Never auto-closes a demand — it only
 * flags onboarding rows whose 90-day closure_due_at has passed so the AM can review
 * and confirm via POST /api/demands/[id]/close.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rows = await prisma.onboardings.findMany({
    where: { closed_at: null, closure_due_at: { lte: new Date() } },
    include: {
      candidates: { select: { full_name: true } },
      demands: { select: { id: true, request_id: true } },
    },
    orderBy: { closure_due_at: 'asc' },
  });

  if (rows.length === 0) {
    console.log('[closure-cron] No demands are past their closure due date.');
    return;
  }

  console.log(`[closure-cron] ${rows.length} onboarding(s) past their 90-day closure due date, pending AM feedback:`);
  for (const r of rows) {
    console.log(`  - ${r.demands?.request_id ?? r.demand_id ?? 'unknown demand'} / ${r.candidates?.full_name ?? 'unknown candidate'} (due ${r.closure_due_at?.toISOString()})`);
  }
}

main()
  .catch((err) => {
    console.error('[closure-cron] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
