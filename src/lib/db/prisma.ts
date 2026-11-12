import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL everywhere we set it ourselves (local, Docker, Neon). On Netlify with Netlify
// Database the platform injects NETLIFY_DB_URL instead, so fall back to it.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || process.env.NETLIFY_DB_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
