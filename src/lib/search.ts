import { Prisma } from '@/generated/prisma/client';

/** Builds a case-insensitive Prisma `contains` OR clause from caller-supplied fields. */
export function buildSearchWhere<TWhereInput extends Record<string, unknown>>(
  search: string | undefined | null,
  fields: readonly string[]
): TWhereInput['OR'] | undefined {
  const term = search?.trim();
  if (!term || fields.length === 0) return undefined;

  return fields.map((field) => ({
    [field]: { contains: term, mode: 'insensitive' as Prisma.QueryMode },
  })) as TWhereInput['OR'];
}

/** Same as buildSearchWhere but for raw-SQL queries; also matches Postgres array columns. */
export function buildRawIlikeWhere(
  search: string | undefined | null,
  textFields: readonly string[],
  arrayFields: readonly string[] = []
): Prisma.Sql {
  const term = search?.trim();
  if (!term || (textFields.length === 0 && arrayFields.length === 0)) return Prisma.empty;

  const pattern = `%${term}%`;
  const conditions = [
    ...textFields.map((field) => Prisma.sql`${Prisma.raw(field)} ILIKE ${pattern}`),
    ...arrayFields.map((field) => Prisma.sql`array_to_string(${Prisma.raw(field)}, ',') ILIKE ${pattern}`),
  ];

  return Prisma.sql`(${Prisma.join(conditions, ' OR ')})`;
}

/**
 * Builds a raw-SQL condition matching rows whose `arrayField` (a Postgres text[] column, e.g.
 * candidates.skills) has at least one entry that case-insensitively overlaps (substring, either
 * direction) at least one entry in `terms` (e.g. a demand's technology_stack). Both sides are
 * compared trimmed + lowercased — matches the existing case-insensitive-compare convention
 * already used for skill de-duplication (candidate.schema.ts's dedupedStringArray), just applied
 * to overlap instead of uniqueness. Returns Prisma.empty if there are no terms to match against
 * (caller should treat that as "matches nothing", not "matches everything" — see call site).
 */
export function buildRawSkillOverlapWhere(arrayField: string, terms: readonly string[]): Prisma.Sql {
  const cleaned = terms.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return Prisma.empty;

  const conditions = cleaned.map(
    (term) => Prisma.sql`EXISTS (
      SELECT 1 FROM unnest(${Prisma.raw(arrayField)}) AS skill
      WHERE LOWER(TRIM(skill)) LIKE '%' || LOWER(${term.trim()}) || '%'
         OR LOWER(${term.trim()}) LIKE '%' || LOWER(TRIM(skill)) || '%'
    )`
  );

  return Prisma.sql`(${Prisma.join(conditions, ' OR ')})`;
}
