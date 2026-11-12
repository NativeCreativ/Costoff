'use client';

import { CandidateConversationLog } from '@/components/candidates/CandidateConversationLog';
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { X, StickyNote, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useDemandCandidateDetailQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useChangeSubmissionStatusMutation, useAddSubmissionEventMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { CandidateEventTimeline } from './CandidateEventTimeline';
import { CandidateInterviewsSection } from './CandidateInterviewsSection';
import { CandidateOnboardingSection } from './CandidateOnboardingSection';
import { SUBMISSION_STATUS_COLORS, submissionStatusLabel } from './statusStyles';
import { SUBMISSION_STATUS_VALUES, SUBMISSION_FORWARD_ORDER, SUBMISSION_TERMINAL_EXIT_STATUSES } from '@/lib/demandFulfillment/constants';

interface CandidateDetailPanelProps {
  requestId: string;
  dcId: string;
  canManage: boolean;
  /** Interview-specific permission (excludes spoc, who can manage the pipeline generally
   *  but is read-only for Interviews). Falls back to canManage when omitted. */
  canManageInterviews?: boolean;
  onClose: () => void;
}

type QuickEventType = 'note' | 'call_log';

const QUICK_EVENT_META: Record<QuickEventType, { label: string; icon: any; placeholder: string }> = {
  note: { label: 'Add Note', icon: StickyNote, placeholder: 'Write a note…' },
  call_log: { label: 'Log Call', icon: Phone, placeholder: 'Call summary…' },
};

export function CandidateDetailPanel({ requestId, dcId, canManage, canManageInterviews = canManage, onClose }: CandidateDetailPanelProps) {
  const detailQuery = useDemandCandidateDetailQuery(requestId, dcId);
  const statusMutation = useChangeSubmissionStatusMutation(requestId);
  const eventMutation = useAddSubmissionEventMutation(requestId);

  const [pendingStatus, setPendingStatus] = useState<{ to: string; requiresRemark: boolean } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusRemark, setStatusRemark] = useState('');
  const [quickEvent, setQuickEvent] = useState<QuickEventType | null>(null);
  const [quickEventContent, setQuickEventContent] = useState('');
  const [quickEventFollowUp, setQuickEventFollowUp] = useState('');

  const submission = detailQuery.data?.submission;
  const events = detailQuery.data?.events ?? [];
  const interviews = detailQuery.data?.interviews ?? [];
  const otherDemands = detailQuery.data?.otherDemands ?? [];

  // Demand-level `canManage` is the VIEW + CREATE right; the server additionally reports a
  // per-row `can_edit` (creator ownership: submissions.added_by). Both must hold before any
  // pipeline MUTATION is offered, so another recruiter's row shows the actions disabled
  // with the reason rather than letting the user hit a 403.
  const rowCanEdit = canManage && (submission as { can_edit?: boolean } | undefined)?.can_edit !== false;
  const rowEditBlockedReason = ((submission as { edit_blocked_reason?: string | null } | undefined)
    ?.edit_blocked_reason) || null;

  const isReversal = (to: string) => {
    if (!submission) return false;
    const fromIdx = SUBMISSION_FORWARD_ORDER.indexOf(submission.current_status as any);
    const toIdx = SUBMISSION_FORWARD_ORDER.indexOf(to as any);
    if (fromIdx === -1 || toIdx === -1) return false;
    return toIdx < fromIdx;
  };
  const isTerminal = (to: string) => SUBMISSION_TERMINAL_EXIT_STATUSES.includes(to as any);

  const handleStatusSelect = (to: string) => {
    if (!submission || to === submission.current_status) return;
    setStatusError(null);
    setStatusRemark('');
    setPendingStatus({ to, requiresRemark: isReversal(to) || isTerminal(to) });
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    setStatusError(null);
    statusMutation.mutate(
      { dcId, to_status: pendingStatus.to, remark: statusRemark.trim() || undefined },
      {
        onSuccess: () => { setPendingStatus(null); setStatusRemark(''); },
        onError: (err) => setStatusError(isAxiosError(err) ? err.response?.data?.error || 'Failed to change status' : 'Failed to change status'),
      }
    );
  };

  const submitQuickEvent = () => {
    if (!quickEvent) return;
    eventMutation.mutate(
      {
        dcId,
        payload: {
          event_type: quickEvent,
          content: quickEventContent.trim() || undefined,
          follow_up_at: quickEvent === 'call_log' && quickEventFollowUp ? quickEventFollowUp : undefined,
        },
      },
      { onSuccess: () => { setQuickEvent(null); setQuickEventContent(''); setQuickEventFollowUp(''); } }
    );
  };

  const statusColor = submission ? SUBMISSION_STATUS_COLORS[submission.current_status] : undefined;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[2000] flex justify-end bg-[rgba(15,23,42,0.55)] backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-[600px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#0f172a] px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="truncate text-[1.05rem] font-bold text-[#f8fafc]">{submission?.candidates?.full_name || 'Candidate'}</div>
            <div className="mt-0.5 text-[0.76rem] text-[#94a3b8]">{submission?.candidates?.email} {submission?.candidates?.phone ? `· ${submission.candidates.phone}` : ''}</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {detailQuery.isLoading ? (
            <Loader message="Loading candidate detail…" />
          ) : !submission ? (
            <div className="py-10 text-center text-[0.85rem] text-[#dc2626]">Could not load this candidate.</div>
          ) : (
            <>
              {/* Status + quick actions */}
              <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Badge className="border-transparent text-[0.78rem] font-bold" style={{ backgroundColor: statusColor?.bg, color: statusColor?.text }}>
                    {submissionStatusLabel(submission.current_status)}
                  </Badge>
                  {submission.final_result && (
                    <Badge className="border-transparent bg-[#f1f5f9] text-[0.72rem] font-semibold text-[#64748b] hover:bg-[#f1f5f9]">
                      Final: {submission.final_result}
                    </Badge>
                  )}
                </div>
                {!rowCanEdit && rowEditBlockedReason && (
                  <div className="mb-3 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
                    {rowEditBlockedReason}
                  </div>
                )}
                {rowCanEdit && submission.is_active && (
                  <Select value="" onValueChange={(to) => { if (to) handleStatusSelect(to); }}>
                    <SelectTrigger className="h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] text-[#334155] shadow-none">
                      <SelectValue placeholder="Change status to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBMISSION_STATUS_VALUES.filter((s) => s !== submission.current_status).map((s) => (
                        <SelectItem key={s} value={s}>
                          {submissionStatusLabel(s)}{isReversal(s) ? ' (backward — remark required)' : isTerminal(s) ? ' (remark required)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {rowCanEdit && pendingStatus && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <div className="text-[0.82rem] font-semibold text-[#0f172a]">
                      Change status to {submissionStatusLabel(pendingStatus.to)}
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">
                        Remark {pendingStatus.requiresRemark && <span className="text-[#dc2626]">*</span>}
                        {!pendingStatus.requiresRemark && <span className="font-normal text-[#94a3b8]"> (optional)</span>}
                      </label>
                      <Textarea
                        autoFocus
                        rows={3}
                        value={statusRemark}
                        onChange={(e) => setStatusRemark(e.target.value)}
                        placeholder="Add context for this action…"
                        className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
                      />
                      {pendingStatus.requiresRemark && (
                        <span className="mt-1 block text-[0.72rem] text-[#94a3b8]">A remark is required for this action.</span>
                      )}
                    </div>
                    {statusError && (
                      <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{statusError}</div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setPendingStatus(null); setStatusError(null); setStatusRemark(''); }} disabled={statusMutation.isPending}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={confirmStatusChange}
                        disabled={statusMutation.isPending || (pendingStatus.requiresRemark && !statusRemark.trim())}
                      >
                        {statusMutation.isPending ? 'Saving…' : 'Confirm'}
                      </Button>
                    </div>
                  </div>
                )}

                {rowCanEdit && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.keys(QUICK_EVENT_META) as QuickEventType[]).map((key) => {
                      const meta = QUICK_EVENT_META[key];
                      const Icon = meta.icon;
                      const isActive = quickEvent === key;
                      return (
                        <Button
                          key={key}
                          size="sm"
                          variant="outline"
                          onClick={() => { setQuickEvent(isActive ? null : key); setQuickEventContent(''); setQuickEventFollowUp(''); }}
                          className={isActive ? 'gap-1.5 border-[#2563eb] bg-[#eff6ff] text-[#2563eb]' : 'gap-1.5'}
                        >
                          <Icon className="h-3.5 w-3.5" /> {meta.label}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {rowCanEdit && quickEvent && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Textarea
                      autoFocus
                      rows={3}
                      value={quickEventContent}
                      onChange={(e) => setQuickEventContent(e.target.value)}
                      placeholder={QUICK_EVENT_META[quickEvent].placeholder}
                      className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
                    />
                    {quickEvent === 'call_log' && (
                      <div>
                        <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Next Follow-up (optional)</label>
                        <input
                          type="date"
                          value={quickEventFollowUp}
                          onChange={(e) => setQuickEventFollowUp(e.target.value)}
                          className="w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setQuickEvent(null); setQuickEventContent(''); setQuickEventFollowUp(''); }}>Cancel</Button>
                      <Button size="sm" onClick={submitQuickEvent} disabled={eventMutation.isPending || !quickEventContent.trim()}>
                        {eventMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Candidate info */}
              <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Candidate Info</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8rem] text-[#334155]">
                  <div><strong>Experience:</strong> {submission.candidates?.total_experience || '—'}</div>
                  <div><strong>Current Company:</strong> {submission.candidates?.current_company || '—'}</div>
                  <div><strong>Skills:</strong> {submission.candidates?.skills?.join(', ') || '—'}</div>
                  <div><strong>Source:</strong> {submission.source.replace(/_/g, ' ')}</div>
                </div>
              </div>

              {/* Other demand history — info, not a blocker */}
              {otherDemands.length > 0 && (
                <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                  <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">History in Other Demands</div>
                  <div className="flex flex-col gap-1.5">
                    {otherDemands.map((od: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[0.78rem] text-[#475569]">
                        <span>{od.demands?.request_id || od.demand_id} — {od.demands?.skill_description || od.demands?.company_name || ''}</span>
                        <Badge className="border-transparent bg-[#f1f5f9] text-[0.68rem] font-semibold text-[#64748b] hover:bg-[#f1f5f9]">{submissionStatusLabel(od.current_status)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Log — tagged with this demand */}
              {submission.candidate_id && (
                <CandidateConversationLog candidateId={submission.candidate_id} demandId={submission.demand_id ?? null} />
              )}

              {/* Interviews */}
              <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                <CandidateInterviewsSection requestId={requestId} dcId={dcId} interviews={interviews} canManage={canManageInterviews} candidateName={submission.candidates?.full_name} />
              </div>

              {/* Onboarding — visible once relevant */}
              {['onboarding', 'bgv_pending', 'bgv_verified', 'joined'].includes(submission.current_status) && (
                <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                  <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Onboarding</div>
                  <CandidateOnboardingSection requestId={requestId} dcId={dcId} canManage={rowCanEdit} />
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-xl border border-[color:var(--card-border)] p-4">
                <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Activity Timeline</div>
                <CandidateEventTimeline
                  events={events}
                  interviewsById={Object.fromEntries(interviews.map((iv) => [iv.id, iv]))}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
