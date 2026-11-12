import { prisma } from '@/lib/db/prisma';

/**
 * The simple name + Active/Inactive masters. Each stores its own rows; demands and
 * interviews keep the chosen *name* (or, for phases, are only counted by it) so a
 * rename of an in-use row is blocked instead of rewriting history.
 */
export const NAMED_MASTER_KINDS = [
  'demand-categories',
  'demand-phases',
  'locations',
  'demand-types',
  'interview-statuses',
  'skill-classifications',
] as const;

export type NamedMasterKind = (typeof NAMED_MASTER_KINDS)[number];

export function isNamedMasterKind(value: string): value is NamedMasterKind {
  return (NAMED_MASTER_KINDS as readonly string[]).includes(value);
}

type NameRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_transition?: boolean;
  requires_result?: boolean;
};

type NameDelegate = {
  findMany: (args?: object) => Promise<NameRow[]>;
  findFirst: (args: object) => Promise<NameRow | null>;
  findUnique: (args: object) => Promise<NameRow | null>;
  create: (args: object) => Promise<NameRow>;
  update: (args: object) => Promise<NameRow>;
  delete: (args: object) => Promise<NameRow>;
  aggregate: (args: object) => Promise<{ _max: { sort_order: number | null } }>;
};

function delegate(kind: NamedMasterKind): NameDelegate {
  switch (kind) {
    case 'demand-categories':
      return prisma.demand_categories as unknown as NameDelegate;
    case 'demand-phases':
      return prisma.demand_phases as unknown as NameDelegate;
    case 'locations':
      return prisma.locations as unknown as NameDelegate;
    case 'demand-types':
      return prisma.demand_types as unknown as NameDelegate;
    case 'interview-statuses':
      return prisma.interview_statuses as unknown as NameDelegate;
    case 'skill-classifications':
      return prisma.skill_classifications as unknown as NameDelegate;
  }
}

/** How many saved records still carry this row's name (or, for classifications, its id). */
export async function countNamedMasterUsage(kind: NamedMasterKind, row: { id: string; name: string }): Promise<number> {
  const name = row.name;
  switch (kind) {
    case 'demand-categories':
      return prisma.demands.count({ where: { role_category: { equals: name, mode: 'insensitive' } } });
    case 'demand-phases':
      return prisma.demands.count({ where: { status: { equals: name, mode: 'insensitive' } } });
    case 'locations':
      return prisma.demands.count({ where: { locations: { has: name } } });
    case 'demand-types':
      return prisma.demands.count({ where: { demand_type: { equals: name, mode: 'insensitive' } } });
    case 'interview-statuses':
      return prisma.interviews.count({ where: { status: { equals: name, mode: 'insensitive' } } });
    case 'skill-classifications':
      return prisma.skills.count({ where: { classification_id: row.id } });
  }
}

export async function listNamedMaster(kind: NamedMasterKind, includeInactive: boolean) {
  const rows = await delegate(kind).findMany({
    where: includeInactive ? undefined : { is_active: true },
    orderBy: { sort_order: 'asc' },
  });
  const withUsage = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      usage: { records: await countNamedMasterUsage(kind, row) },
    }))
  );
  return withUsage;
}

export async function createNamedMaster(kind: NamedMasterKind, name: string) {
  const model = delegate(kind);
  const existing = await model.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    return { error: `A ${labelFor(kind)} named "${name}" already exists`, status: 409 as const };
  }
  const max = await model.aggregate({ _max: { sort_order: true } });
  const data: Record<string, unknown> = {
    name,
    sort_order: (max._max.sort_order ?? 0) + 1,
  };
  if (kind === 'interview-statuses') {
    data.is_transition = true;
    data.requires_result = false;
  }
  const item = await model.create({ data });
  return { item };
}

export async function updateNamedMaster(kind: NamedMasterKind, id: string, name: string) {
  const model = delegate(kind);
  const existing = await model.findUnique({ where: { id } });
  if (!existing) return { error: 'Not found', status: 404 as const };
  const owner = await model.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (owner && owner.id !== id) {
    return { error: `A ${labelFor(kind)} named "${name}" already exists`, status: 409 as const };
  }
  const nameChanging = existing.name.trim().toLowerCase() !== name.trim().toLowerCase();
  if (nameChanging) {
    const usage = await countNamedMasterUsage(kind, existing);
    if (usage > 0) {
      return {
        error: `"${existing.name}" is in use (${usage} record${usage === 1 ? '' : 's'}) and cannot be renamed.`,
        status: 409 as const,
      };
    }
  }
  const item = await model.update({ where: { id }, data: { name } });
  return { item };
}

export async function deleteNamedMaster(kind: NamedMasterKind, id: string) {
  const model = delegate(kind);
  const existing = await model.findUnique({ where: { id } });
  if (!existing) return { error: 'Not found', status: 404 as const };
  const usage = await countNamedMasterUsage(kind, existing);
  if (usage > 0) {
    return {
      error: `"${existing.name}" is in use (${usage} record${usage === 1 ? '' : 's'}) and cannot be deleted.`,
      status: 409 as const,
    };
  }
  await model.delete({ where: { id } });
  return { ok: true as const };
}

export async function toggleNamedMaster(kind: NamedMasterKind, id: string, isActive: boolean) {
  const model = delegate(kind);
  const existing = await model.findUnique({ where: { id } });
  if (!existing) return { error: 'Not found', status: 404 as const };
  const item = await model.update({ where: { id }, data: { is_active: isActive } });
  return { item };
}

export async function reorderNamedMaster(kind: NamedMasterKind, orderedIds: string[]) {
  const model = delegate(kind);
  const existing = await model.findMany();
  const known = new Set(existing.map((row) => row.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    return { error: 'orderedIds must list every row exactly once', status: 400 as const };
  }
  await prisma.$transaction(
    orderedIds.map((id, index) => {
      switch (kind) {
        case 'demand-categories':
          return prisma.demand_categories.update({ where: { id }, data: { sort_order: index + 1 } });
        case 'demand-phases':
          return prisma.demand_phases.update({ where: { id }, data: { sort_order: index + 1 } });
        case 'locations':
          return prisma.locations.update({ where: { id }, data: { sort_order: index + 1 } });
        case 'demand-types':
          return prisma.demand_types.update({ where: { id }, data: { sort_order: index + 1 } });
        case 'interview-statuses':
          return prisma.interview_statuses.update({ where: { id }, data: { sort_order: index + 1 } });
        case 'skill-classifications':
          return prisma.skill_classifications.update({ where: { id }, data: { sort_order: index + 1 } });
      }
    })
  );
  return { items: await listNamedMaster(kind, true) };
}

function labelFor(kind: NamedMasterKind): string {
  switch (kind) {
    case 'demand-categories':
      return 'demand category';
    case 'demand-phases':
      return 'demand phase';
    case 'locations':
      return 'location';
    case 'demand-types':
      return 'demand type';
    case 'interview-statuses':
      return 'interview status';
    case 'skill-classifications':
      return 'skill category';
  }
}
