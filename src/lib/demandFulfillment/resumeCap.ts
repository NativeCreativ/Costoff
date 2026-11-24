import { prisma } from '@/lib/db/prisma';
import { DEFAULT_RESUME_CAP_PER_POSITION, SUPER_ADMIN_SETTINGS_KEYS } from './constants';

/**
 * Resolves the per-position resume cap for a demand: client-level override (companies.max_submissions_per_position)
 * takes precedence, falling back to global super_admin_settings value, then the hardcoded default (5).
 *
 * Cap = num_positions * resume_cap_per_position, e.g. 4 positions x 5 = 20 active profiles.
 * Further uploads are kept as Backup rather than rejected.
 */
export async function getResumeCapPerPosition(companyId?: string | null): Promise<number> {
  if (companyId) {
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
      select: { max_submissions_per_position: true },
    });
    if (company?.max_submissions_per_position != null && company.max_submissions_per_position > 0) {
      return company.max_submissions_per_position;
    }
  }

  const setting = await prisma.super_admin_settings.findUnique({
    where: { key: SUPER_ADMIN_SETTINGS_KEYS.resumeCapPerPosition },
  });
  if (setting && typeof setting.value === 'number') return setting.value;
  if (setting && typeof setting.value === 'string' && !Number.isNaN(Number(setting.value))) {
    return Number(setting.value);
  }
  return DEFAULT_RESUME_CAP_PER_POSITION;
}

export interface ResumeCapStatus {
  cap: number;
  current: number;
  reached: boolean;
}

/** Counts only *active* candidate-in-demand rows (backup profiles and rejected/dropped candidates do not fill active slots). */
export async function getResumeCapStatus(
  demandId: string,
  numPositions: number | null | undefined,
  companyId?: string | null
): Promise<ResumeCapStatus> {
  let resolvedCompanyId = companyId;
  if (resolvedCompanyId === undefined) {
    const demand = await prisma.demands.findUnique({
      where: { id: demandId },
      select: { company_id: true },
    });
    resolvedCompanyId = demand?.company_id ?? null;
  }
  const capPerPosition = await getResumeCapPerPosition(resolvedCompanyId);
  const cap = Math.max(1, numPositions ?? 1) * capPerPosition;
  const current = await prisma.submissions.count({
    where: {
      demand_id: demandId,
      is_active: true,
      OR: [{ sourcing_type: 'active' }, { sourcing_type: null }],
    },
  });
  return { cap, current, reached: current >= cap };
}
