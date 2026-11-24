'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { CalendarPlus, ChevronDown, ChevronUp, Video, Phone as PhoneIcon, MapPin, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormSelect } from '@/components/ui/FormSelect';
import { Loader } from '@/components/ui/Loader';
import { useInterviewConfigQuery, useSuperAdminSettingsDFQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useScheduleInterviewMutation, useUpdateInterviewMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import {
  INTERVIEW_COMPLETED_STATUS,
  INTERVIEW_RESULT_OPTIONS,
} from '@/constants/options';
import { useInterviewStatusOptions } from '@/components/interviews/useInterviewStatusOptions';
import { HARDCODED_DEFAULT_INTERVIEW_MODES } from '@/lib/demandFulfillment/constants';
import { normalizeInterviewResult } from '@/lib/auth/interviewPermissions';
import { CandidateInterviewDrawer } from './CandidateInterviewDrawer';
import type { DemandInterview } from '@/components/types';
import { formatScheduledDate, formatScheduledTime, calculateDurationMinutes, formatDurationMinutes } from '@/lib/utils';

const MODE_ICON: Record<string, any> = { Video: Video, Phone: PhoneIcon, 'In-Person': MapPin };
const RESULT_OPTIONS = [{ value: '', label: 'Result…' }, ...INTERVIEW_RESULT_OPTIONS];

/** Badge styling keyed by the NORMALIZED result, so 'on hold' and 'on_hold' match. */
const RESULT_BADGE_CLASS: Record<string, string> = {
  pass: 'bg-[#dcfce7] text-[#166534]',
  fail: 'bg-[#fee2e2] text-[#dc2626]',
  on_hold: 'bg-[#fef3c7] text-[#92400e]',
};

interface CandidateInterviewsSectionProps {
  requestId: string;
  dcId: string;
  interviews: DemandInterview[];
  canManage: boolean;
  /** Read-only display context — this panel is already scoped to one Demand/Candidate, so
   *  Request ID/Candidate are shown, never selectable, here. */
  candidateName?: string;
}

export function CandidateInterviewsSection({ requestId, dcId, interviews, canManage, candidateName }: CandidateInterviewsSectionProps) {
  const { transition: transitionStatusOptions } = useInterviewStatusOptions();
  const configQuery = useInterviewConfigQuery(requestId);
  const scheduleMutation = useScheduleInterviewMutation(requestId);
  const updateMutation = useUpdateInterviewMutation(requestId);

  const rounds = configQuery.data?.rounds ?? [];
  const [showDrawer, setShowDrawer] = useState(false);
  const [form, setForm] = useState({
    round_id: '',
    scheduled_date: '',
    scheduled_time: '',
    end_time: '',
    mode: '',
    meeting_link: '',
    remark: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<{ id: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // When the round changes, prefill the mode from that round's mode (if any).
  // The user can still edit it — it's free text, not a locked dropdown.
  const selectedRound = useMemo(
    () => rounds.find((r) => r.id === form.round_id),
    [rounds, form.round_id]
  );

  useEffect(() => {
    if (selectedRound?.mode) setForm((f) => ({ ...f, mode: selectedRound.mode || '' }));
  }, [selectedRound?.mode]);

  // Duration is auto-calculated from Start/End Time — never manually entered, same
  // calculateDurationMinutes/formatDurationMinutes helpers as the finalized Interview form.
  const durationMinutes = useMemo(
    () => calculateDurationMinutes(form.scheduled_time, form.end_time),
    [form.scheduled_time, form.end_time]
  );

  const resetForm = () => setForm({ round_id: '', scheduled_date: '', scheduled_time: '', end_time: '', mode: '', meeting_link: '', remark: '' });

  const handleSchedule = () => {
    setError(null);
    if (!form.round_id || !form.scheduled_date) {
      setError('Round and date are required');
      return;
    }
    scheduleMutation.mutate(
      {
        dcId,
        payload: {
          round_id: form.round_id,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time || undefined,
          end_time: form.end_time || undefined,
          duration_minutes: durationMinutes ?? undefined,
          mode: form.mode,
          meeting_link: form.meeting_link || undefined,
          remark: form.remark || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
          resetForm();
        },
        onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to schedule interview' : 'Failed to schedule interview'),
      }
    );
  };

  const handleUpdate = (interviewId: string, patch: { status?: string; feedback?: string; result?: string }) => {
    updateMutation.mutate({ interviewId, payload: patch });
  };

  /**
   * Choosing 'Completed' does not save on its own — it opens a Result picker and the
   * status+result are saved together once a result is chosen. Any other status (including a
   * re-schedule back to 'Scheduled') is saved immediately and cancels a pending Completed.
   * This is what keeps a Result from ever being recorded against an interview that isn't
   * Completed. A re-schedule keeps the row's existing round — picking a different round for
   * the same interview is done from the Edit Interview form.
   */
  const handleStatusChange = (interviewId: string, nextStatus: string) => {
    if (nextStatus === INTERVIEW_COMPLETED_STATUS) {
      setPendingCompletion((prev) => (prev?.id === interviewId ? prev : { id: interviewId }));
      return;
    }
    // Any other status saves straight away, and clears any result this interview may have
    // carried so the row never shows a pass/fail beside a No-Show or a re-booked slot.
    setPendingCompletion(null);
    handleUpdate(interviewId, { status: nextStatus, result: '' });
  };

  const handlePendingResult = (interviewId: string, result: string) => {
    if (!result) return;
    setPendingCompletion(null);
    handleUpdate(interviewId, { status: INTERVIEW_COMPLETED_STATUS, result });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Interview Rounds</span>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={() => setShowDrawer(true)}>
            <Calendar className="h-3.5 w-3.5" /> Interview Manager
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" /> Quick Schedule
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
          {configQuery.isLoading ? (
            <Loader message="" size="sm" className="p-4" />
          ) : configQuery.isError ? (
            <div className="text-[0.8rem] text-[#dc2626]">Failed to load interview rounds. Please try again.</div>
          ) : rounds.length === 0 ? (
            <div className="text-[0.8rem] text-[#dc2626]">No interview rounds are configured for this demand.</div>
          ) : (
            <>
              <div className="text-[0.78rem] text-[#475569]">
                Scheduling for <strong className="text-[#0f172a]">{candidateName || 'this candidate'}</strong> — Requirement <strong className="text-[#0f172a]">{requestId}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Interview Round" required options={rounds.map((r) => ({ value: r.id, label: `Round ${r.round_order} — ${r.name}` }))} value={form.round_id} onChange={(v) => setForm((f) => ({ ...f, round_id: v }))} small />
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Mode</label>
                  <Input value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} placeholder="e.g. Video call, In-person" className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Date <span className="text-[#dc2626]">*</span></label>
                  <Input type="date" min={new Date().toISOString().split('T')[0]}  value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Start Time</label>
                  <Input type="time" value={form.scheduled_time} onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value }))} className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">End Time</label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Duration (Auto Calculated)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={formatDurationMinutes(durationMinutes) || '—'}
                    className="h-auto w-full cursor-not-allowed rounded-md border border-[#e2e8f0] bg-white px-2.5 py-2 text-[0.83rem] text-[#64748b] shadow-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Meeting Link</label>
                <Input value={form.meeting_link} onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))} className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
              </div>
              <div>
                <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Remark (optional)</label>
                <Textarea rows={2} value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none" />
              </div>
              {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.76rem] text-[#dc2626]">{error}</div>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSchedule} disabled={scheduleMutation.isPending}>{scheduleMutation.isPending ? 'Scheduling…' : 'Schedule Interview'}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">No interviews scheduled yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {interviews.map((iv) => {
            const isExpanded = expandedId === iv.id;
            const ModeIcon = MODE_ICON[iv.mode || 'Video'] || Video;
            return (
              <div key={iv.id} className="rounded-md border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : iv.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ModeIcon className="h-4 w-4 shrink-0 text-[#64748b]" />
                    <div className="min-w-0">
                      {/* Round name first, then "Round N — Name" so the sequence is obvious
                          when several rounds are listed for one candidate. */}
                      <div className="truncate text-[0.83rem] font-semibold text-[#0f172a]">{iv.round_name || '—'}</div>
                      <div className="truncate text-[0.72rem] text-[#94a3b8]">
                        {iv.round_order ? `Round ${iv.round_order}` : 'Round'}{iv.round_name ? ` · ${iv.round_name}` : ''}
                        {iv.scheduled_date ? ` · ${formatScheduledDate(iv.scheduled_date)}` : ''}
                        {iv.scheduled_time ? ` · ${formatScheduledTime(iv.scheduled_time)}` : ''}
                      </div>
                    </div>
                  </div>
                  {/* Status and Result sit directly beside the round they describe, so a
                      "Completed / pass" badge is never read against the wrong round. */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge className="border-transparent bg-[#f1f5f9] text-[0.7rem] font-semibold text-[#475569] hover:bg-[#f1f5f9]">{iv.status}</Badge>
                    {iv.result && (
                      <Badge className={`border-transparent text-[0.7rem] font-semibold hover:bg-inherit ${RESULT_BADGE_CLASS[normalizeInterviewResult(iv.result) ?? ''] ?? 'bg-[#f1f5f9] text-[#475569]'}`}>
                        {iv.result.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-[#94a3b8]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[#94a3b8]" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-2 border-t border-[#f1f5f9] p-3">
                    {iv.end_time && <div className="text-[0.78rem] text-[#475569]">Ends: {formatScheduledTime(iv.end_time)}</div>}
                    {iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noreferrer" className="text-[0.78rem] font-semibold text-[#2563eb] underline">Meeting link</a>}
                    {iv.feedback && <div className="rounded-md bg-[#f8fafc] p-2 text-[0.78rem] text-[#475569]">{iv.feedback}</div>}

                    {/*
                      Status/Result are MUTATIONS, so they need the stricter creator rule
                      (`iv.can_manage`, server-computed from interviews.created_by), not the
                      demand-level `canManage` that gates scheduling. The controls stay
                      visible but disabled with the reason in the title, so it is obvious the
                      action exists and why it is unavailable.
                    */}
                    {canManage && (
                      /* A bordered block with its own header instead of loose inline
                         controls: Status and Result previously sat side by side with
                         no fixed width, so the two Radix triggers overlapped each other
                         and the Result label collided with the Status trigger. */
                      <div className="mt-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                        {/* The round this status/result belongs to, repeated here so the
                            outcome is never ambiguous when several rounds are listed. */}
                        <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">
                          Outcome for {iv.round_name || 'this round'}
                        </div>

                        {/* Edit lock follows the interview's own STATUS (Completed is
                            locked, regardless of result), matching the Interviews table and
                            the PATCH route. Evaluated per round — another round's status
                            never affects this one. */}
                        {iv.status === INTERVIEW_COMPLETED_STATUS ? (
                          <span className="text-[0.75rem] text-[#991b1b]">
                            This interview is Completed and can no longer be edited.
                          </span>
                        ) : iv.can_manage === false ? (
                          <span
                            className="text-[0.75rem] text-[#92400e]"
                            title={iv.manage_blocked_reason || 'You cannot manage this interview'}
                          >
                            {iv.manage_blocked_reason || 'You cannot change this interview — it was scheduled by someone else.'}
                          </span>
                        ) : (
                          /* Fixed-width grid: each select gets its own cell so the
                             triggers can never overlap, and the Result cell only takes
                             space once the status is being set to Completed. */
                          <div className="grid grid-cols-2 gap-2.5">
                            <FormSelect
                              label="Status"
                              options={transitionStatusOptions}
                              value={iv.status || ''}
                              onChange={(v) => handleStatusChange(iv.id, v)}
                              small
                            />
                            {pendingCompletion?.id === iv.id && (
                              <div>
                                <FormSelect
                                  label="Result"
                                  required
                                  options={RESULT_OPTIONS}
                                  value=""
                                  onChange={(v) => handlePendingResult(iv.id, v)}
                                  small
                                />
                                <button
                                  type="button"
                                  onClick={() => setPendingCompletion(null)}
                                  className="mt-1 cursor-pointer border-none bg-none p-0 text-[0.72rem] font-medium text-[#64748b] underline-offset-2 hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showDrawer && (
        <CandidateInterviewDrawer
          open={true}
          onClose={() => setShowDrawer(false)}
          requestId={requestId}
          dcId={dcId}
          candidateName={candidateName}
        />
      )}
    </div>
  );
}
