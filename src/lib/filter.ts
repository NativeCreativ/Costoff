import { Prisma } from '@/generated/prisma/client';

/** Builds a Prisma exact-match filter object from caller-supplied column/value pairs, dropping empty values. */
export function buildExactMatchWhere<TWhereInput extends Record<string, unknown>>(
  filters: Record<string, string | undefined | null>
): Partial<TWhereInput> {
  const where: Record<string, string> = {};

  for (const [field, value] of Object.entries(filters)) {
    if (value) where[field] = value;
  }

  return where as Partial<TWhereInput>;
}

/** Same as buildExactMatchWhere but for raw-SQL queries; returns a list of `column = value` conditions. */
export function buildRawExactMatchWhere(
  filters: Record<string, string | undefined | null>
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  for (const [field, value] of Object.entries(filters)) {
    if (value) conditions.push(Prisma.sql`${Prisma.raw(field)} = ${value}`);
  }

  return conditions;
}
