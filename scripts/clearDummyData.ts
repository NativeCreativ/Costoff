/**
 * Deletes only the demo set created by scripts/seedDummyData.ts.
 * Safe to re-run when some of those rows are already gone.
 *
 * Markers: CSF-DUMMY-* demands, @costaff-demo.in users, @dummymail.in candidates,
 * [TEST] clients / end clients / skill groups, and *-demo.in company emails.
 * The live super admin superadmin@gmail.com is never touched.
 *
 * Usage: npm run seed:dummy:clear
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LIVE_SUPER_ADMIN = 'superadmin@gmail.com';

async function ids(rows: { id: string }[]): Promise<string[]> {
  return rows.map((row) => row.id);
}

async function main() {
  const demands = await prisma.demands.findMany({
    where: { request_id: { startsWith: 'CSF-DUMMY-' } },
    select: { id: true, request_id: true },
  });
  const demandIds = await ids(demands);

  const candidates = await prisma.candidates.findMany({
    where: { email: { endsWith: '@dummymail.in' } },
    select: { id: true },
  });
  const candidateIds = await ids(candidates);

  const profiles = await prisma.profiles.findMany({
    where: {
      email: { endsWith: '@costaff-demo.in' },
      NOT: { email: LIVE_SUPER_ADMIN },
    },
    select: { id: true, email: true },
  });
  const profileIds = await ids(profiles);

  const companies = await prisma.companies.findMany({
    where: {
      OR: [
        { email: { endsWith: '-demo.in' } },
        { name: { startsWith: '[TEST]' } },
        { client_name: { startsWith: '[TEST]' } },
      ],
    },
    select: { id: true },
  });
  const companyIds = await ids(companies);

  const endClients = await prisma.end_clients.findMany({
    where: { name: { startsWith: '[TEST]' } },
    select: { id: true },
  });
  const endClientIds = await ids(endClients);

  const skillGroups = await prisma.skill_categories.findMany({
    where: { name: { startsWith: '[TEST]' } },
    select: { id: true },
  });
  const skillGroupIds = await ids(skillGroups);

  const submissionWhere = {
    OR: [
      ...(demandIds.length ? [{ demand_id: { in: demandIds } }] : []),
      ...(candidateIds.length ? [{ candidate_id: { in: candidateIds } }] : []),
    ],
  };
  const submissions = submissionWhere.OR.length
    ? await prisma.submissions.findMany({ where: submissionWhere, select: { id: true } })
    : [];
  const submissionIds = await ids(submissions);

  if (submissionIds.length) {
    await prisma.submission_events.deleteMany({ where: { submission_id: { in: submissionIds } } });
  }
  if (demandIds.length || candidateIds.length) {
    await prisma.interviews.deleteMany({
      where: {
        OR: [
          ...(demandIds.length ? [{ demand_id: { in: demandIds } }] : []),
          ...(candidateIds.length ? [{ candidate_id: { in: candidateIds } }] : []),
        ],
      },
    });
    await prisma.onboardings.deleteMany({
      where: {
        OR: [
          ...(demandIds.length ? [{ demand_id: { in: demandIds } }] : []),
          ...(candidateIds.length ? [{ candidate_id: { in: candidateIds } }] : []),
        ],
      },
    });
    await prisma.offers.deleteMany({
      where: {
        OR: [
          ...(demandIds.length ? [{ demand_id: { in: demandIds } }] : []),
          ...(candidateIds.length ? [{ candidate_id: { in: candidateIds } }] : []),
        ],
      },
    });
  }
  if (submissionIds.length) {
    await prisma.submissions.deleteMany({ where: { id: { in: submissionIds } } });
  }
  if (demandIds.length) {
    await prisma.demand_assignment_events.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.demand_assignments.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.demand_status_events.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.demand_ta_allocations.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.demand_interview_config.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.demand_interview_rounds.deleteMany({ where: { demand_id: { in: demandIds } } });
    await prisma.notifications.deleteMany({ where: { entity_id: { in: demandIds } } });
    await prisma.demands.deleteMany({ where: { id: { in: demandIds } } });
  }
  if (candidateIds.length) {
    await prisma.candidates.deleteMany({ where: { id: { in: candidateIds } } });
  }
  if (companyIds.length) {
    await prisma.companies.deleteMany({ where: { id: { in: companyIds } } });
  }
  if (endClientIds.length) {
    await prisma.end_clients.deleteMany({ where: { id: { in: endClientIds } } });
  }
  if (skillGroupIds.length) {
    await prisma.skill_categories.deleteMany({ where: { id: { in: skillGroupIds } } });
  }
  if (profileIds.length) {
    await prisma.notifications.deleteMany({ where: { user_id: { in: profileIds } } });
    await prisma.profiles.deleteMany({ where: { id: { in: profileIds } } });
  }

  console.log('Cleared demo demands:', demands.map((row) => row.request_id).join(', ') || '(none)');
  console.log(`Cleared demo candidates: ${candidateIds.length}`);
  console.log(`Cleared demo users: ${profiles.map((row) => row.email).join(', ') || '(none)'}`);
  console.log(`Cleared demo clients: ${companyIds.length}, end clients: ${endClientIds.length}, skill groups: ${skillGroupIds.length}`);
}

main()
  .catch((err) => {
    console.error('Clear demo data failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
