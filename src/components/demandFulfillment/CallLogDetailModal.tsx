'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateTime } from '@/lib/utils';
import type { DemandCallLogEntry } from '@/services/demandFulfillment.service';
import { useSkillsLibraryQuery } from '@/queries/settings/useSkillsLibraryQueries';
import { useUpdateDemandCallMutation } from '@/queries/demandFulfillment/useCallLogAndInstructions';
import { CALL_OUTCOME_LABELS, FITMENT_FAIL_REASONS, callLogUpdateSchema, type CallOutcome } from './callLog.schema';

interface CallLogDetailModalProps {
  requestId: string;
  call: DemandCallLogEntry;
  onClose: () => void;
  /** Demand Match not yet in Sourcing: open the candidate form to finish it. */
  onAddToSourcing: (call: DemandCallLogEntry) => void;
}

const KNOWN_REASONS: readonly string[] = FITMENT_FAIL_REASONS;

/** One logged call: everything captured, editable any time by whoever may log calls here. */
export function CallLogDetailModal({ requestId, call, onClose, onAddToSourcing }: CallLogDetailModalProps) {
  const update = useUpdateDemandCallMutation(requestId);
  const library = useSkillsLibraryQuery();
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>(call.outcome);
  const startReason = call.fail_reason && !KNOWN_REASONS.includes(call.fail_reason) ? 'Other' : call.fail_reason || '';
  const [reason, setReason] = useState(startReason);
  const [otherReason, setOtherReason] = useState(startReason === 'Other' ? call.fail_reason || '' : '');
  const [notes, setNotes] = useState(call.notes || '');
  const [skillGroupId, setSkillGroupId] = useState(call.skill_group_id || '');
  const [error, setError] = useState<string | null>(null);
  const c = call.candidate;

  const save = () => {
    const parsed = callLogUpdateSchema.safeParse({
      outcome,
      fail_reason: outcome === 'not_fit' ? (reason === 'Other' ? otherReason.trim() : reason) || null : null,
      notes: notes.trim() || null,
      skill_group_id: skillGroupId || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the call details');
      return;
    }
    setError(null);
    update.mutate({ callId: call.id, payload: parsed.data }, { onSuccess: () => setEditing(false) });
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 text-[0.82rem]">
      <span className="w-36 shrink-0 font-semibold text-[#475569]">{label}</span>
      <span className="text-[#0f172a]">{value || '—'}</span>
    </div>
  );

  return (
    <Modal title={`Call — ${c?.full_name ?? 'Candidate'}`} subtitle={`${formatDateTime(call.created_at)} · by ${call.caller_name || '—'}`} onClose={onClose} closeDisabled={update.isPending} width="640px">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
          {row('Phone', c?.phone)}
          {row('Email', c?.email)}
          {row('Current company', c?.current_company)}
          {row('Location', c?.current_location)}
          {row('Total experience', c?.total_experience)}
          {row('Notice period', c?.availability)}
          {row('Expected CTC', c?.expected_ctc != null ? String(c.expected_ctc) : null)}
          {row('Source', c?.source)}
        </div>

        {!editing ? (
          <div className="flex flex-col gap-1.5">
            {row('Result', (
              <Badge className={cn('border-transparent', call.outcome === 'demand_match' ? 'bg-[#f0fdf4] text-[#15803d] hover:bg-[#f0fdf4]' : 'bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]')}>
                {CALL_OUTCOME_LABELS[call.outcome]}{call.moved_to_sourcing ? ' → in Sourcing' : ''}
              </Badge>
            ))}
            {call.outcome === 'not_fit' && row('Fail reason', call.fail_reason)}
            {row('Skill group', call.skill_group_name)}
            {row('Notes', <span className="whitespace-pre-wrap">{call.notes}</span>)}
            {call.updated_at && row('Last edited', `${formatDateTime(call.updated_at)} by ${call.updated_by_name || '—'}`)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {(['demand_match', 'not_fit'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={outcome === value}
                  onClick={() => setOutcome(value)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-[0.82rem] font-semibold',
                    outcome === value
                      ? value === 'demand_match' ? 'border-[#16a34a] bg-[#f0fdf4] text-[#15803d]' : 'border-[#dc2626] bg-[#fef2f2] text-[#b91c1c]'
                      : 'border-[#e2e8f0] bg-white text-[#475569]'
                  )}
                >
                  {CALL_OUTCOME_LABELS[value]}
                </button>
              ))}
            </div>
            {outcome === 'not_fit' && (
              <>
                <select aria-label="Fail reason" className="button-select h-9 text-[0.8rem]" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Select the fitment fail reason</option>
                  {FITMENT_FAIL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {reason === 'Other' && <Input className="h-9" placeholder="Describe the reason" maxLength={100} value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />}
              </>
            )}
            <select aria-label="Skill group" className="button-select h-9 text-[0.8rem]" value={skillGroupId} onChange={(e) => setSkillGroupId(e.target.value)}>
              <option value="">No skill group</option>
              {call.skill_group_id && !(library.data ?? []).some((g) => g.id === call.skill_group_id) && (
                <option value={call.skill_group_id}>{call.skill_group_name ?? 'Saved group'}</option>
              )}
              {(library.data ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call notes" className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.8rem] shadow-none" />
            {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {call.can_edit && !editing && call.outcome === 'demand_match' && !call.moved_to_sourcing && (
            <Button type="button" onClick={() => onAddToSourcing(call)}>Complete &amp; add to Sourcing</Button>
          )}
          {call.can_edit && !editing && <Button type="button" variant="outline" onClick={() => setEditing(true)}>Edit call</Button>}
          {editing && (
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button>
              <Button type="button" onClick={save} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
            </>
          )}
          {!editing && <Button type="button" variant="outline" onClick={onClose}>Close</Button>}
        </div>
      </div>
    </Modal>
  );
}
