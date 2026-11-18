import { prisma } from '@/lib/db/prisma';

/** A call's skill group must be an active skill_categories row. */
export async function isActiveSkillGroup(id: string): Promise<boolean> {
  const row = await prisma.skill_categories.findFirst({ where: { id, is_active: true }, select: { id: true } });
  return !!row;
}
