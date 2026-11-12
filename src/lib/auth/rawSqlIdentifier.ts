import { Prisma } from '@/generated/prisma/client';

export function rawIdentifier(alias: string): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error(`Unsafe SQL identifier: ${alias}`);
  }
  return Prisma.raw(alias);
}