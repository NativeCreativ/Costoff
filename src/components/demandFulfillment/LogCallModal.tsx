'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { CANDIDATE_SOURCE_VALUES, NOTICE_PERIOD_VALUES } from '@/components/candidates/candidate.schema';
import { useCandidatesQuery } from '@/queries/candidates/useCandidatesQuery';
import { useLogDemandCallMutation } from '@/queries/demandFulfillment/useCallLogAndInstructions';
import { useSkillsLibraryQuery } from '@/queries/settings/useSkillsLibraryQueries';
import {
  FITMENT_FAIL_REASONS,
  callLogSchema,
  type CallNewCandidate,
  type CallOutcome,
} from './callLog.schema';

const EMPTY_CANDIDATE: CallNewCandidate = {
  full_name: '',
  phone: '',
  email: '',
  current_company: '',
  current_location: '',
  total_experience: '',
  availability: 'Immediate',
  expected_ctc: '',
  source: 'naukri',
};

/**
 * Log a call about a candidate for this demand. The candidate is someone already in our database
 * (search) or new (quick details — saved to the candidate database either way). "Demand Match"
 * stores the call and hands over to the full candidate form (onDemandMatch), which lists the
 * candidate in Sourcing once saved; "Not fit" asks for the Fitment Fail Reason.
 */
export function LogCallModal({
  requestId,
  onClose,
  onDemandMatch,
}: {
  requestId: string;
  onClose: () => void;
  onDemandMatch: (match: { callId: string; candidateId: string; canEditCandidate: boolean; skillGroupId?: string | null }) => void;
}) {
  const toast = useToast();
  const library = useSkillsLibraryQuery();
  const [skillGroupId, setSkillGroupId] = useState('');
  const logCall = useLogDemandCallMutation(requestId);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [candidate, setCandidate] = useState<CallNewCandidate>(EMPTY_CANDIDATE);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useCandidatesQuery({ search, pageSize: 8 });
  const matches = search.trim() ? searchQuery.data?.data ?? [] : [];

  const set = (field: keyof CallNewCandidate) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCandidate((c) => ({ ...c, [field]: e.target.value }));

  const submit = () => {
    const payload = {
      candidate_id: mode === 'existing' ? picked?.id ?? null : null,
      new_candidate: mode === 'new' ? candidate : null,
      outcome,
      fail_reason: outcome === 'not_fit' ? (reason === 'Other' ? otherReason.trim() : reason) || null : null,
      notes: notes.trim() || null,
      skill_group_id: skillGroupId || null,
    };
    const parsed = callLogSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the call details');
      return;
    }
    setError(null);
    logCall.mutate(parsed.data, {
      onSuccess: (res) => {
        const who = res.reused_existing_candidate ? ' (matched an existing profile)' : '';
        if (parsed.data.outcome === 'demand_match') {
          toast.success('Demand Match logged', `Complete the candidate details to add them to Sourcing${who}.`);
          onDemandMatch({
            callId: res.call.id,
            candidateId: res.candidate_id,
            canEditCandidate: res.can_edit_candidate,
            skillGroupId: res.skill_group_id ?? parsed.data.skill_group_id ?? null,
          });
        } else {
          toast.success('Call logged', `Profile kept in the candidate database${who}.`);
        }
        onClose();
      },
    });
  };

  const inputClass = 'h-9';
  return (
    <Modal title="Log a Call" subtitle="Record the call and whether the candidate fits this demand." onClose={onClose} closeDisabled={logCall.isPending} width="720px">
      <div className="flex flex-col gap-3">
        <div className="flex rounded-md border border-[#e2e8f0] bg-white p-0.5" role="group" aria-label="Candidate">
          {(['new', 'existing'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn('flex-1 rounded px-3 py-1.5 text-[0.8rem] font-medium', mode === m ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f8fafc]')}
            >
              {m === 'new' ? 'New candidate' : 'Existing candidate'}
            </button>
          ))}
        </div>

        {mode === 'existing' ? (
          <div className="flex flex-col gap-2">
            <SearchInput value={search} onDebouncedChange={(v) => { setSearch(v); setPicked(null); }} placeholder="Search name, email or phone…" />
            {picked ? (
              <div className="flex items-center justify-between rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[0.82rem]">
                <span className="font-semibold text-[#1d4ed8]">{picked.name}</span>
                <button type="button" className="text-[0.75rem] text-[#64748b] hover:underline" onClick={() => setPicked(null)}>Change</button>
              </div>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded-md border border-[#e2e8f0]">
                {!search.trim() && <li className="px-3 py-2 text-[0.78rem] text-[#94a3b8]">Type to search the candidate database.</li>}
                {search.trim() && matches.length === 0 && !searchQuery.isFetching && (
                  <li className="px-3 py-2 text-[0.78rem] text-[#94a3b8]">No match. Switch to “New candidate”.</li>
                )}
                {matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-[0.8rem] hover:bg-[#f8fafc]" onClick={() => setPicked({ id: c.id, name: c.full_name })}>
                      <span className="font-semibold text-[#0f172a]">{c.full_name}</span>
                      <span className="ml-2 text-[#64748b]">{[c.phone, c.email, c.current_company].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input className={inputClass} placeholder="Full name *" value={candidate.full_name} onChange={set('full_name')} />
            <Input className={inputClass} placeholder="Phone *" value={candidate.phone} onChange={set('phone')} />
            <Input className={inputClass} placeholder="Email" value={candidate.email} onChange={set('email')} />
            <Input className={inputClass} placeholder="Current company" value={candidate.current_company} onChange={set('current_company')} />
            <Input className={inputClass} placeholder="Current location" value={candidate.current_location} onChange={set('current_location')} />
            <Input className={inputClass} placeholder="Total experience" value={candidate.total_experience} onChange={set('total_experience')} />
            <select aria-label="Notice period" className="button-select h-9 text-[0.8rem]" value={candidate.availability} onChange={set('availability')}>
              {NOTICE_PERIOD_VALUES.map((v) => <option key={v} value={v}>Notice: {v}</option>)}
            </select>
            <Input className={inputClass} placeholder="Expected CTC" inputMode="numeric" value={candidate.expected_ctc} onChange={set('expected_ctc')} />
            <select aria-label="Source" className="button-select h-9 text-[0.8rem] capitalize" value={candidate.source} onChange={set('source')}>
              {CANDIDATE_SOURCE_VALUES.map((v) => <option key={v} value={v}>Source: {v}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]" htmlFor="call-skill-group">Skill Group</label>
          <select id="call-skill-group" className="button-select h-9 w-full text-[0.8rem]" value={skillGroupId} onChange={(e) => setSkillGroupId(e.target.value)}>
            <option value="">Select a skill group (optional)</option>
            {(library.data ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">Does the candidate match this demand? *</div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={outcome === 'demand_match'}
              onClick={() => setOutcome('demand_match')}
              className={cn('flex-1 rounded-md border px-3 py-2 text-[0.82rem] font-semibold', outcome === 'demand_match' ? 'border-[#16a34a] bg-[#f0fdf4] text-[#15803d]' : 'border-[#e2e8f0] bg-white text-[#475569]')}
            >
              Demand Match
            </button>
            <button
              type="button"
              aria-pressed={outcome === 'not_fit'}
              onClick={() => setOutcome('not_fit')}
              className={cn('flex-1 rounded-md border px-3 py-2 text-[0.82rem] font-semibold', outcome === 'not_fit' ? 'border-[#dc2626] bg-[#fef2f2] text-[#b91c1c]' : 'border-[#e2e8f0] bg-white text-[#475569]')}
            >
              Not fit — keep in database
            </button>
          </div>
        </div>

        {outcome === 'not_fit' && (
          <div className="flex flex-col gap-2">
            <div className="text-[0.8rem] font-semibold text-[#475569]">Fitment fail reason *</div>
            <div className="flex flex-wrap gap-1.5">
              {FITMENT_FAIL_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn('rounded-full border px-2.5 py-1 text-[0.75rem]', reason === r ? 'border-[#dc2626] bg-[#fef2f2] text-[#b91c1c]' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]')}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && <Input className={inputClass} placeholder="Describe the reason" value={otherReason} maxLength={100} onChange={(e) => setOtherReason(e.target.value)} />}
          </div>
        )}

        <Textarea
          rows={2}
          value={notes}
          placeholder="Call notes (optional): what was discussed, expectations, availability…"
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.8rem] shadow-none"
        />
        {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={logCall.isPending}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={logCall.isPending}>{logCall.isPending ? 'Saving…' : 'Log Call'}</Button>
        </div>
      </div>
    </Modal>
  );
}
