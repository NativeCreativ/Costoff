import type { Prisma } from '@/generated/prisma/client';
import type { ClientSpocItem, SpocItem } from '@/components/masterData/spoc.schema';

type SpocClient = Prisma.TransactionClient;

function toRows(items: SpocItem[]) {
  return items
    .map((item, index) => ({
      name: item.name.trim(),
      email: item.email?.trim() || null,
      phone: item.phone?.trim() || null,
      designation: item.designation?.trim() || null,
      sort_order: index,
    }))
    .filter((item) => item.name.length > 0);
}

function toClientRow(item: ClientSpocItem, index: number) {
  return {
    name: item.name.trim(),
    email: item.email?.trim() || null,
    phone: item.phone?.trim() || null,
    designation: item.designation?.trim() || null,
    vertical: item.vertical?.trim() || null,
    supervisor: item.supervisor?.trim() || null,
    supervisor_designation: item.supervisor_designation?.trim() || null,
    is_active: item.is_active !== false,
    sort_order: index,
  };
}

/**
 * Saves a client's whole SPOC list. Callers pass the list only when the client sent `spocs`.
 *
 * Rows are matched by id and UPDATED, never deleted-and-recreated: demands store their picked
 * SPOCs as ids (demands.client_spoc_ids), so new ids would silently drop them from every demand.
 * A row the user removed is deleted only when no demand uses it; otherwise it is kept and marked
 * inactive, so those demands still show who their contact was.
 */
export async function replaceCompanySpocs(companyId: string, items: ClientSpocItem[], tx: SpocClient) {
  const existing = await tx.company_spocs.findMany({ where: { company_id: companyId }, select: { id: true } });
  const existingIds = new Set(existing.map((row) => row.id));
  const rows = items.filter((item) => item.name.trim().length > 0);
  const keptIds = new Set<string>();

  for (const [index, item] of rows.entries()) {
    const data = toClientRow(item, index);
    if (item.id && existingIds.has(item.id)) {
      await tx.company_spocs.update({ where: { id: item.id }, data });
      keptIds.add(item.id);
    } else {
      // An unknown id (another client's SPOC, or a stale one) is treated as a new row rather
      // than trusted, so one client's save can never touch another client's contacts.
      await tx.company_spocs.create({ data: { ...data, company_id: companyId } });
    }
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length === 0) return;
  const inUse = await tx.demands.findMany({
    where: { company_id: companyId, client_spoc_ids: { hasSome: removedIds } },
    select: { client_spoc_ids: true },
  });
  const inUseIds = new Set(inUse.flatMap((demand) => demand.client_spoc_ids).filter((id) => removedIds.includes(id)));
  const deletable = removedIds.filter((id) => !inUseIds.has(id));
  if (deletable.length > 0) await tx.company_spocs.deleteMany({ where: { id: { in: deletable } } });
  if (inUseIds.size > 0) {
    await tx.company_spocs.updateMany({
      where: { id: { in: [...inUseIds] } },
      data: { is_active: false, sort_order: rows.length },
    });
  }
}

export async function replaceEndClientSpocs(endClientId: string, items: SpocItem[], tx: SpocClient) {
  await tx.end_client_spocs.deleteMany({ where: { end_client_id: endClientId } });
  const rows = toRows(items);
  if (rows.length === 0) return;
  await tx.end_client_spocs.createMany({
    data: rows.map((row) => ({ ...row, end_client_id: endClientId })),
  });
}
