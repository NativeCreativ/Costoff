import { prisma } from '@/lib/db/prisma';
import { DEFAULT_RESUME_CAP_PER_POSITION, SUPER_ADMIN_SETTINGS_KEYS } from './constants';

/**
 * Resolves the per-position resume cap for a demand: demand-level override (none
 * currently modeled — demands.num_positions is the only demand-specific knob) falls
 * back to the global super_admin_settings value, then the hardcoded default.
 *
 * Cap = num_positions * resume_cap_per_position, e.g. 4 positions x 5 = 20 active profiles.
 * Further uploads are kept as Backup rather than rejected.
 */
export async function getResumeCapPerPosition(): Promise<number> {
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

/** Counts only *active* candidate-in-demand rows (rejected/dropped candidates free up a cap slot). */
export async function getResumeCapStatus(demandId: string, numPositions: number | null | undefined): Promise<ResumeCapStatus> {
  const capPerPosition = await getResumeCapPerPosition();
  const cap = Math.max(1, numPositions ?? 1) * capPerPosition;
  const current = await prisma.submissions.count({
    where: { demand_id: demandId, is_active: true },
  });
  return { cap, current, reached: current >= cap };
}
