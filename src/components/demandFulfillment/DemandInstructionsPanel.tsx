'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from '@/components/ui/Loader';
import { InlineDeleteConfirm } from '@/components/ui/InlineDeleteConfirm';
import { formatScheduledDate } from '@/lib/utils';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';
import {
  INSTRUCTION_SOURCE_LABELS,
  INSTRUCTION_SOURCE_VALUES,
  demandInstructionSchema,
  type DemandInstructionValues,
} from './callLog.schema';
import {
  useDeleteDemandInstructionMutation,
  useDemandInstructionsQuery,
  useSaveDemandInstructionMutation,
} from '@/queries/demandFulfillment/useCallLogAndInstructions';
import type { DemandInstruction } from '@/services/demandFulfillment.service';

const emptyDraft = (): DemandInstructionValues => ({ source: 'meeting', instruction_date: todayInIndia(), content: '' });

/**
 * Instruction Log tab: what the customer asked for (meetings, emails, calls), written by the
 * demand's AM / SPOC / Delivery Head so the recruiters can follow it. Read by everyone who can
 * see the demand.
 */
export function DemandInstructionsPanel({ requestId }: { requestId: string }) {
  const query = useDemandInstructionsQuery(requestId);
  const save = useSaveDemandInstructionMutation(requestId);
  const remove = useDeleteDemandInstructionMutation(requestId);
  const [draft, setDraft] = useState<DemandInstructionValues>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = query.data?.instructions ?? [];

  const submit = () => {
    const parsed = demandInstructionSchema.safeParse(draft);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the instruction');
    setError(null);
    save.mutate({ id: editingId, values: parsed.data }, { onSuccess: () => { setDraft(emptyDraft()); setEditingId(null); } });
  };

  const startEdit = (item: DemandInstruction) => {
    setEditingId(item.id);
    setDraft({ source: item.source as DemandInstructionValues['source'], instruction_date: item.instruction_date, content: item.content });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.8rem] text-[#64748b]">Instructions from the customer for the recruiting team: what to look for, what to avoid, interview preferences.</p>

      {query.data?.can_add && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Instruction source"
              className="button-select h-9 w-[180px] text-[0.8rem]"
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value as DemandInstructionValues['source'] }))}
            >
              {INSTRUCTION_SOURCE_VALUES.map((s) => <option key={s} value={s}>{INSTRUCTION_SOURCE_LABELS[s]}</option>)}
            </select>
            <Input
              type="date"
              aria-label="Instruction date"
              className="h-9 w-[160px] bg-white"
              value={draft.instruction_date}
              onChange={(e) => setDraft((d) => ({ ...d, instruction_date: e.target.value }))}
            />
          </div>
          <Textarea
            rows={3}
            value={draft.content}
            placeholder="e.g. Customer wants candidates with hands-on Selenium + REST Assured, no pure manual testers. Prefer Bangalore; immediate joiners first."
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            className="w-full resize-y rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.82rem] shadow-none"
          />
          {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(null); setDraft(emptyDraft()); setError(null); }}>
                Cancel edit
              </Button>
            )}
            <Button type="button" size="sm" disabled={save.isPending || !draft.content.trim()} onClick={submit}>
              {save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add instruction'}
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <Loader message="Loading instructions…" />
      ) : query.isError ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the instruction log.</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-[0.85rem] text-[#94a3b8]">No instructions recorded for this demand yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-[#64748b]">
                  <Badge variant="secondary">{INSTRUCTION_SOURCE_LABELS[item.source as keyof typeof INSTRUCTION_SOURCE_LABELS] ?? item.source}</Badge>
                  <span className="font-semibold text-[#334155]">{formatScheduledDate(item.instruction_date)}</span>
                  {item.created_by_name && <span>· {item.created_by_name}</span>}
                </div>
                {item.can_manage && (
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Edit instruction" className="text-[#64748b] hover:text-[#2563eb]" onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <InlineDeleteConfirm
                      isConfirming={confirmingId === item.id}
                      onDeleteRequest={() => setConfirmingId(item.id)}
                      onCancel={() => setConfirmingId(null)}
                      onConfirm={() => remove.mutate(item.id, { onSettled: () => setConfirmingId(null) })}
                      disabled={remove.isPending}
                    />
                  </div>
                )}
              </div>
              <div className="whitespace-pre-wrap text-[0.85rem] text-[#0f172a]">{item.content}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
