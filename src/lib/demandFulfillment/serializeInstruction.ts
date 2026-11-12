import { fromDbDate } from '@/lib/teamWork/serialize';

export const INSTRUCTION_INCLUDE = { profiles: { select: { full_name: true, role: true } } } as const;

export function serializeInstruction(row: {
  id: string;
  source: string;
  instruction_date: Date;
  content: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  profiles: { full_name: string; role: string } | null;
}) {
  return {
    id: row.id,
    source: row.source,
    instruction_date: fromDbDate(row.instruction_date)!,
    content: row.content,
    created_by: row.created_by,
    created_by_name: row.profiles?.full_name ?? null,
    created_by_role: row.profiles?.role ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
