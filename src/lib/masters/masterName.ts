

/** Postgres unique-violation SQLSTATE surfaced by Prisma. */
export const PG_UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

export function findByNormalizedName<TRow extends { name: string }>(delegate: {
  findFirst: (args: { where: { name: { equals: string; mode: 'insensitive' } } }) => Promise<unknown>;
}): (name: string) => Promise<TRow | null> {
  return async (name: string) => {
    const term = name.trim();
    if (!term) return null;
    return (await delegate.findFirst({ where: { name: { equals: term, mode: 'insensitive' } } })) as TRow | null;
  };
}