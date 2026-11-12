import { prisma } from '@/lib/db/prisma';
import { DEMAND_EMPLOYMENT_TYPE_VALUES } from '@/components/demands/demand.schema';
import { isAllowedListValue } from '@/lib/settingsListValidation';
import { firstDisallowedText } from '@/lib/masters/textList';

export interface DemandMasterInput {
  role_category?: string | null;
  demand_type?: string | null;
  locations?: string[] | null;
  end_client_id?: string | null;
}

export interface DemandMasterCurrent {
  role_category?: string | null;
  demand_type?: string | null;
  locations?: string[] | null;
  end_client_id?: string | null;
}

/**
 * Validates the demand fields that now come from Master Data.
 * Names are stored as text (grandfather rule). End client is an optional FK:
 * active on create, or the demand's current id on update.
 */
export async function demandMasterFieldError(
  input: DemandMasterInput,
  current?: DemandMasterCurrent
): Promise<string | null> {
  if (input.role_category !== undefined && input.role_category !== null && input.role_category !== '') {
    const rows = await prisma.demand_categories.findMany({
      where: { is_active: true },
      select: { name: true },
    });
    const active = rows.length > 0 ? rows.map((r) => r.name) : [...DEMAND_EMPLOYMENT_TYPE_VALUES];
    if (!isAllowedListValue(input.role_category, current?.role_category, active)) {
      return 'Select an active demand category';
    }
  }

  if (input.demand_type !== undefined && input.demand_type !== null && input.demand_type !== '') {
    const rows = await prisma.demand_types.findMany({
      where: { is_active: true },
      select: { name: true },
    });
    if (rows.length > 0 && !isAllowedListValue(input.demand_type, current?.demand_type, rows.map((r) => r.name))) {
      return 'Select an active demand type';
    }
  }

  if (input.locations) {
    const rows = await prisma.locations.findMany({
      where: { is_active: true },
      select: { name: true },
    });
    const bad = firstDisallowedText(input.locations, current?.locations ?? [], rows.map((r) => r.name));
    if (bad) return `"${bad}" is not an active location`;
  }

  if (input.end_client_id) {
    const endClient = await prisma.end_clients.findUnique({
      where: { id: input.end_client_id },
      select: { id: true, status: true },
    });
    if (!endClient) return 'Selected end client was not found';
    const kept = current?.end_client_id && current.end_client_id === endClient.id;
    if (endClient.status !== 'ACTIVE' && !kept) return 'Selected end client is inactive';
  }

  return null;
}
