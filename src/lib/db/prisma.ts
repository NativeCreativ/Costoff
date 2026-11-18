import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL everywhere we set it ourselves (local, Docker, Neon). On Netlify with Netlify
// Database the platform injects NETLIFY_DB_URL instead, so fall back to it.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || process.env.NETLIFY_DB_URL });

// candidates.pan_encrypted is never returned unless a query selects it explicitly (only
// GET /api/candidates/[id]/pan does), so no route can leak it by loading a whole candidate row.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter, omit: { candidates: { pan_encrypted: true } } });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
