import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com';
// The default is for local development only. For any hosted database pass a strong password
// in SUPER_ADMIN_PASSWORD — this value is in the repository, so it is effectively public.
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SUPER_ADMIN_FULL_NAME = 'Delivery Head';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
 

  const password_hash = await hashPassword(SUPER_ADMIN_PASSWORD);

  const profile = await prisma.profiles.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      password_hash,
      role: 'super_admin',
      is_active: true,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      full_name: SUPER_ADMIN_FULL_NAME,
      role: 'super_admin',
      password_hash,
      is_active: true,
    },
  });

  // Never print the password hash.
  console.log('Super admin created/updated:', { id: profile.id, email: profile.email, role: profile.role });
}


main()
  .catch((err) => {
    console.error('Failed to create super admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
