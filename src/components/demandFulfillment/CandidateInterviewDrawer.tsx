'use client';

import { useState, useMemo } from 'react';
import { X, Calendar, Clock, Plus, History, Lock, CheckCircle2, XCircle, AlertCircle, Trash2, Video, Phone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { FormSelect } from '@/components/ui/FormSelect';
import { useToast } from '@/components/ui/Toast';
import { canUnlockRound } from '@/lib/demandFulfillment/interviewManagerRules';
import {
  useCandidateInterviewsQuery,
  useSaveInterviewRoundMutation,
} from '@/queries/demandFulfillment/useInterviewManagerQueries';
import type { InterviewManagerRound, SaveInterviewRoundPayload } from '@/services/interviewManager.service';

interface CandidateInterviewDrawerProps {
  requestId: string;
  dcId: string;
  candidateName?: string;
  open?: boolean;
  onClose: () => void;
  canManage?: boolean;
}

const INTERVIEW_TYPE_OPTIONS = [
  { value: 'Technical', label: 'Technical' },
  { value: 'Functional', label: 'Functional' },
  { value: 'Managerial', label: 'Managerial' },
];

const INTERVIEW_MODE_OPTIONS = [
  { value: 'Virtual', label: 'Virtual' },
  { value: 'Telephonic', label: 'Telephonic' },
  { value: 'In-Person', label: 'In-Person' },
];

const INTERVIEW_MEDIUM_OPTIONS = [
  { value: 'Teams Meeting', label: 'Teams Meeting' },
  { value: 'Slack Meeting', label: 'Slack Meeting' },
  { value: 'Direct_Call', label: 'Direct Call' },
  { value: 'Zoom_Meeting', label: 'Zoom Meeting' },
];

const INTERVIEW_STATUS_OPTIONS = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rescheduled', label: 'Rescheduled' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const INTERVIEW_RESULT_OPTIONS = [
  { value: 'Selected', label: 'Selected' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Feedback Awaiting', label: 'Feedback Awaiting' },
  { value: 'Onhold', label: 'On hold' },
];

const INTERVIEW_REASON_OPTIONS = [
  { value: 'Candidate_No_Show', label: 'Candidate No Show' },
  { value: 'Panel_No_Show', label: 'Panel No Show' },
  { value: 'Candidate_Not_Available', label: 'Candidate Not Available' },
  { value: 'Client_No_Show', label: 'Client No Show' },
  { value: 'Others', label: 'Others' },
];

export function CandidateInterviewDrawer({
  requestId,
  dcId,
  candidateName,
  open = true,
  onClose,
  canManage = true,
}: CandidateInterviewDrawerProps) {
  if (!open) return null;
  const toast = useToast();
  const { data, isLoading, isError } = useCandidateInterviewsQuery(requestId, dcId);
  const saveMutation = useSaveInterviewRoundMutation(requestId, dcId);

  // Local state for rounds being edited
  const [editingRoundOrder, setEditingRoundOrder] = useState<number | null>(null);
  const [roundForm, setRoundForm] = useState<Partial<SaveInterviewRoundPayload>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<number, boolean>>({});

  // Adding custom new round
  const [isAddingRound, setIsAddingRound] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundType, setNewRoundType] = useState<'Technical' | 'Functional' | 'Managerial'>('Technical');

  const interviews: InterviewManagerRound[] = data?.interviews ?? [];
  const templateRounds = data?.templateRounds ?? [];
  const hasRejection = data?.hasRejection ?? false;

  // Combine saved interviews with template rounds if candidate has no saved rounds yet
  const displayedRounds: InterviewManagerRound[] = useMemo(() => {
    if (interviews.length > 0) return interviews;
    if (templateRounds.length > 0) {
      return templateRounds.map((t) => ({
        round_order: t.round_order,
        round_name: t.name,
        interview_type: 'Technical',
        scheduled_date: null,
        scheduled_time: null,
        mode: (t.mode === 'InPerson' ? 'In-Person' : 'Virtual') as any,
        medium: 'Teams Meeting',
        status: 'Scheduled',
        result: null,
      }));
    }
    // Fallback default if nothing configured
    return [
      {
        round_order: 1,
        round_name: 'L1 / First Round',
        interview_type: 'Technical',
        scheduled_date: null,
        scheduled_time: null,
        mode: 'Virtual',
        medium: 'Teams Meeting',
        status: 'Scheduled',
        result: null,
      },
    ];
  }, [interviews, templateRounds]);

  // Determine which round is unlocked:
  // Round 1 is unlocked. Round N is unlocked ONLY IF Round N-1 is Completed with Selected.
  const isRoundUnlocked = (roundOrder: number): boolean => {
    if (roundOrder === 1) return true;
    const priorRound = displayedRounds.find((r) => r.round_order === roundOrder - 1);
    return canUnlockRound(roundOrder, priorRound ? { status: priorRound.status, result: priorRound.result } : null);
  };

  // Check if a round was rejected earlier, rendering subsequent rounds not applicable
  const isRoundInapplicable = (roundOrder: number): boolean => {
    const rejectedPrior = displayedRounds.some(
      (r) => r.round_order < roundOrder && r.status === 'Completed' && r.result === 'Rejected'
    );
    return rejectedPrior;
  };

  const startEditRound = (round: InterviewManagerRound) => {
    setFormError(null);
    setEditingRoundOrder(round.round_order);
    setRoundForm({
      action: 'save_round',
      interview_id: round.id,
      round_order: round.round_order,
      round_name: round.round_name,
      interview_type: round.interview_type || 'Technical',
      scheduled_date: round.scheduled_date || '',
      scheduled_time: round.scheduled_time || '',
      mode: round.mode || 'Virtual',
      medium: round.medium || 'Teams Meeting',
      status: round.status || 'Scheduled',
      result: round.result || null,
      reason: round.reason || null,
      custom_reason: round.custom_reason || '',
      reject_reason: round.reject_reason || '',
      comments: round.comments || '',
      reschedule_date: '',
      reschedule_time: '',
    });
  };

  const handleSave = async (roundOrder: number) => {
    setFormError(null);
    if (!roundForm.round_name?.trim()) {
      setFormError('Round name is required');
      return;
    }

    if (roundForm.status === 'Rescheduled') {
      if (!roundForm.reason) {
        setFormError('Reason is mandatory when interview is Rescheduled');
        return;
      }
      if (roundForm.reason === 'Others' && !roundForm.custom_reason?.trim()) {
        setFormError('Please enter a custom reason for rescheduling');
        return;
      }
      if (!roundForm.reschedule_date) {
        setFormError('New reschedule date is required');
        return;
      }
    }

    if (roundForm.status === 'Cancelled' && !roundForm.reason) {
      setFormError('Reason is mandatory when interview is Cancelled');
      return;
    }

    if (roundForm.status === 'Completed') {
      if (!roundForm.result) {
        setFormError('Interview result is required when marking Completed');
        return;
      }
      if (roundForm.result === 'Rejected' && !roundForm.reject_reason?.trim()) {
        setFormError('Reject reason is mandatory when candidate is Rejected');
        return;
      }
    }

    try {
      await saveMutation.mutateAsync({
        ...(roundForm as SaveInterviewRoundPayload),
        action: 'save_round',
        round_order: roundOrder,
      });
      toast.success(`Round ${roundOrder} updated successfully`);
      setEditingRoundOrder(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save round';
      setFormError(msg);
      toast.error('Save failed', msg);
    }
  };

  const handleAddNewRound = async () => {
    if (!newRoundName.trim()) {
      toast.error('Round name required');
      return;
    }
    try {
      await saveMutation.mutateAsync({
        action: 'add_round',
        round_order: displayedRounds.length + 1,
        round_name: newRoundName.trim(),
        interview_type: newRoundType,
        mode: 'Virtual',
        medium: 'Teams Meeting',
        status: 'Scheduled',
      });
      toast.success(`Added ${newRoundName}`);
      setIsAddingRound(false);
      setNewRoundName('');
    } catch (err: any) {
      toast.error('Failed to add round', err?.response?.data?.error || 'Could not add round');
    }
  };

  const handleDeleteRound = async (roundId?: string) => {
    if (!roundId) return;
    if (!confirm('Are you sure you want to delete this interview round?')) return;
    try {
      await saveMutation.mutateAsync({
        action: 'delete_round',
        interview_id: roundId,
        round_order: 1,
        round_name: '',
        interview_type: 'Technical',
        mode: 'Virtual',
        medium: 'Teams Meeting',
        status: 'Scheduled',
      });
      toast.success('Interview round deleted');
      if (editingRoundOrder) setEditingRoundOrder(null);
    } catch (err: any) {
      toast.error('Delete failed', err?.response?.data?.error || 'Could not delete round');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/40 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-[740px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#0f172a] px-6 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[1.1rem] font-bold text-[#f8fafc]">
                {data?.candidate?.full_name || candidateName || 'Candidate Interviews'}
              </span>
              <Badge className="border-transparent bg-white/20 text-[0.7rem] font-semibold text-white">
                Req: {requestId}
              </Badge>
            </div>
            <div className="mt-0.5 text-[0.78rem] text-[#94a3b8]">
              {data?.candidate?.email || '—'} {data?.candidate?.phone ? `· ${data.candidate.phone}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Rejection Alert Banner */}
        {hasRejection && (
          <div className="border-b border-[#fecaca] bg-[#fef2f2] px-6 py-3 text-[0.8rem] text-[#b91c1c] flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-[#dc2626]" />
            <span>Candidate was rejected in one of the interview rounds. Subsequent rounds are closed.</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {isLoading ? (
            <Loader message="Loading interview workflow…" size="md" className="p-12" />
          ) : isError ? (
            <div className="p-8 text-center text-[#dc2626]">
              Failed to load interviews. Please close and try again.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[0.76rem] font-extrabold uppercase tracking-wider text-[#64748b]">
                  Interview Process ({displayedRounds.length} Level{displayedRounds.length === 1 ? '' : 's'})
                </span>
                {canManage && !hasRejection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingRound(true)}
                    className="h-8 gap-1.5 text-[0.78rem] text-[#2563eb] border-[#93c5fd] hover:bg-[#eff6ff]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Level
                  </Button>
                )}
              </div>

              {/* Add Custom Level Modal / Inline Card */}
              {isAddingRound && (
                <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-4 flex flex-col gap-3">
                  <div className="text-[0.82rem] font-bold text-[#1e40af]">Add Custom Interview Level</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">Round Name</label>
                      <Input
                        value={newRoundName}
                        placeholder="e.g. Managerial L2 / Director Round"
                        onChange={(e) => setNewRoundName(e.target.value)}
                        className="h-8 text-[0.82rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">Type</label>
                      <FormSelect
                        options={INTERVIEW_TYPE_OPTIONS}
                        value={newRoundType}
                        onChange={(val) => setNewRoundType(val as any)}
                        small
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setIsAddingRound(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddNewRound} disabled={saveMutation.isPending}>
                      Add Level
                    </Button>
                  </div>
                </div>
              )}

              {/* Round Cards */}
              <div className="flex flex-col gap-4">
                {displayedRounds.map((round) => {
                  const unlocked = isRoundUnlocked(round.round_order);
                  const inapplicable = isRoundInapplicable(round.round_order);
                  const isEditing = editingRoundOrder === round.round_order;
                  const isCompleted = round.status === 'Completed';
                  const isSelected = isCompleted && round.result === 'Selected';
                  const isRejected = isCompleted && round.result === 'Rejected';

                  return (
                    <div
                      key={round.round_order}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#86efac] bg-[#f0fdf4]'
                          : isRejected
                          ? 'border-[#fca5a5] bg-[#fef2f2]'
                          : inapplicable
                          ? 'border-[#e2e8f0] bg-[#f8fafc] opacity-50'
                          : !unlocked
                          ? 'border-[#e2e8f0] bg-[#f8fafc] opacity-75'
                          : 'border-[#cbd5e1] bg-white shadow-sm'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between border-b border-inherit px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f172a] text-[0.72rem] font-bold text-white">
                            {round.round_order}
                          </span>
                          <div>
                            <span className="text-[0.88rem] font-bold text-[#0f172a]">
                              {round.round_name}
                            </span>
                            <span className="ml-2 text-[0.74rem] text-[#64748b]">
                              ({round.interview_type})
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Badge className="bg-[#16a34a] text-white text-[0.72rem] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Selected
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge className="bg-[#dc2626] text-white text-[0.72rem] gap-1">
                              <XCircle className="h-3 w-3" /> Rejected
                            </Badge>
                          )}
                          {!isCompleted && round.status === 'Scheduled' && unlocked && !inapplicable && (
                            <Badge className="bg-[#2563eb] text-white text-[0.72rem]">
                              Scheduled
                            </Badge>
                          )}
                          {!isCompleted && round.status === 'Rescheduled' && (
                            <Badge className="bg-[#d97706] text-white text-[0.72rem]">
                              Rescheduled
                            </Badge>
                          )}
                          {!isCompleted && round.status === 'Cancelled' && (
                            <Badge className="bg-[#64748b] text-white text-[0.72rem]">
                              Cancelled
                            </Badge>
                          )}
                          {!unlocked && !inapplicable && (
                            <Badge className="bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1] text-[0.7rem] gap-1">
                              <Lock className="h-3 w-3" /> Locked
                            </Badge>
                          )}
                          {inapplicable && (
                            <Badge className="bg-[#fee2e2] text-[#991b1b] border-transparent text-[0.7rem]">
                              Not Applicable
                            </Badge>
                          )}

                          {canManage && unlocked && !inapplicable && !isEditing && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditRound(round)}
                              className="h-7 px-2.5 text-[0.74rem]"
                            >
                              Update / Schedule
                            </Button>
                          )}

                          {canManage && round.id && !isCompleted && !isEditing && (
                            <button
                              onClick={() => handleDeleteRound(round.id)}
                              className="text-[#94a3b8] hover:text-[#dc2626] p-1"
                              title="Delete round"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4">
                        {!isEditing ? (
                          /* View Mode Details */
                          <div className="flex flex-col gap-2 text-[0.8rem] text-[#334155]">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[0.78rem]">
                              <div>
                                <span className="block text-[0.7rem] font-semibold uppercase text-[#94a3b8]">Date & Time</span>
                                <span className="font-medium">
                                  {round.scheduled_date ? `${round.scheduled_date} ${round.scheduled_time || ''}` : 'Not scheduled'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[0.7rem] font-semibold uppercase text-[#94a3b8]">Mode</span>
                                <span className="font-medium">{round.mode || 'Virtual'}</span>
                              </div>
                              <div>
                                <span className="block text-[0.7rem] font-semibold uppercase text-[#94a3b8]">Medium</span>
                                <span className="font-medium">{round.medium || 'Teams Meeting'}</span>
                              </div>
                              <div>
                                <span className="block text-[0.7rem] font-semibold uppercase text-[#94a3b8]">Status / Result</span>
                                <span className="font-medium">
                                  {round.status} {round.result ? `· ${round.result}` : ''}
                                </span>
                              </div>
                            </div>

                            {/* Rejection reason banner */}
                            {round.reject_reason && (
                              <div className="mt-2 rounded-md bg-[#fee2e2] p-2 text-[0.76rem] text-[#991b1b]">
                                <strong>Rejection Reason:</strong> {round.reject_reason}
                              </div>
                            )}

                            {/* Cancel/Reschedule reason */}
                            {round.reason && (
                              <div className="mt-1 rounded-md bg-[#fef3c7] p-2 text-[0.76rem] text-[#92400e]">
                                <strong>Reason ({round.status}):</strong>{' '}
                                {round.reason === 'Others' ? round.custom_reason : round.reason.replace(/_/g, ' ')}
                              </div>
                            )}

                            {/* Comments */}
                            {round.comments && (
                              <div className="mt-1 text-[0.76rem] text-[#64748b]">
                                <strong>Comments:</strong> {round.comments}
                              </div>
                            )}

                            {/* Reschedule History Accordion */}
                            {round.history && round.history.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-inherit">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setHistoryOpen((prev) => ({
                                      ...prev,
                                      [round.round_order]: !prev[round.round_order],
                                    }))
                                  }
                                  className="flex items-center gap-1.5 text-[0.74rem] font-semibold text-[#2563eb] hover:underline"
                                >
                                  <History className="h-3.5 w-3.5" />
                                  <span>
                                    {round.history.length} Previous Attempt{round.history.length > 1 ? 's' : ''} (Reschedule History)
                                  </span>
                                </button>

                                {historyOpen[round.round_order] && (
                                  <div className="mt-2 flex flex-col gap-1.5 pl-4 border-l-2 border-[#cbd5e1]">
                                    {round.history.map((h) => (
                                      <div key={h.id} className="text-[0.72rem] text-[#475569] bg-white p-2 rounded border border-[#e2e8f0]">
                                        <div><strong>Date:</strong> {h.scheduled_date || '—'} {h.scheduled_time || ''}</div>
                                        <div><strong>Status:</strong> {h.status}</div>
                                        <div><strong>Reason:</strong> {h.reason === 'Others' ? h.custom_reason : h.reason?.replace(/_/g, ' ')}</div>
                                        {h.comments && <div><strong>Comments:</strong> {h.comments}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Edit Mode Form */
                          <div className="flex flex-col gap-3 rounded-lg bg-white p-3 border border-[#bfdbfe]">
                            <div className="flex items-center justify-between pb-1 border-b border-[#e2e8f0]">
                              <span className="text-[0.82rem] font-bold text-[#1e40af]">
                                Update Round {round.round_order} Details
                              </span>
                              <button
                                onClick={() => setEditingRoundOrder(null)}
                                className="text-[#64748b] hover:text-[#0f172a] text-[0.75rem]"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Round Name <span className="text-[#dc2626]">*</span>
                                </label>
                                <Input
                                  value={roundForm.round_name || ''}
                                  onChange={(e) => setRoundForm({ ...roundForm, round_name: e.target.value })}
                                  placeholder="e.g. L1 / First Round"
                                  className="h-8 text-[0.82rem]"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Type
                                </label>
                                <FormSelect
                                  options={INTERVIEW_TYPE_OPTIONS}
                                  value={roundForm.interview_type || 'Technical'}
                                  onChange={(val) => setRoundForm({ ...roundForm, interview_type: val as any })}
                                  small
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Scheduled Date
                                </label>
                                <Input
                                  type="date"
                                  value={roundForm.scheduled_date || ''}
                                  onChange={(e) => setRoundForm({ ...roundForm, scheduled_date: e.target.value })}
                                  className="h-8 text-[0.82rem]"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Scheduled Time
                                </label>
                                <Input
                                  type="time"
                                  value={roundForm.scheduled_time || ''}
                                  onChange={(e) => setRoundForm({ ...roundForm, scheduled_time: e.target.value })}
                                  className="h-8 text-[0.82rem]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Mode
                                </label>
                                <FormSelect
                                  options={INTERVIEW_MODE_OPTIONS}
                                  value={roundForm.mode || 'Virtual'}
                                  onChange={(val) => setRoundForm({ ...roundForm, mode: val as any })}
                                  small
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Medium
                                </label>
                                <FormSelect
                                  options={INTERVIEW_MEDIUM_OPTIONS}
                                  value={roundForm.medium || 'Teams Meeting'}
                                  onChange={(val) => setRoundForm({ ...roundForm, medium: val as any })}
                                  small
                                />
                              </div>
                            </div>

                            {/* Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                  Status <span className="text-[#dc2626]">*</span>
                                </label>
                                <FormSelect
                                  options={INTERVIEW_STATUS_OPTIONS}
                                  value={roundForm.status || 'Scheduled'}
                                  onChange={(val) => setRoundForm({ ...roundForm, status: val as any })}
                                  small
                                />
                              </div>

                              {/* Result: shown ONLY if Status === 'Completed' */}
                              {roundForm.status === 'Completed' && (
                                <div>
                                  <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                    Result <span className="text-[#dc2626]">*</span>
                                  </label>
                                  <FormSelect
                                    options={INTERVIEW_RESULT_OPTIONS}
                                    value={roundForm.result || ''}
                                    onChange={(val) => setRoundForm({ ...roundForm, result: val as any })}
                                    placeholder="Select Result"
                                    small
                                  />
                                </div>
                              )}
                            </div>

                            {/* Reason: mandatory if Rescheduled or Cancelled */}
                            {(roundForm.status === 'Rescheduled' || roundForm.status === 'Cancelled') && (
                              <div className="flex flex-col gap-2 rounded-md bg-[#fffbeb] p-3 border border-[#fde68a]">
                                <div>
                                  <label className="mb-1 block text-[0.76rem] font-semibold text-[#92400e]">
                                    Reason ({roundForm.status}) <span className="text-[#dc2626]">*</span>
                                  </label>
                                  <FormSelect
                                    options={INTERVIEW_REASON_OPTIONS}
                                    value={roundForm.reason || ''}
                                    onChange={(val) => setRoundForm({ ...roundForm, reason: val as any })}
                                    placeholder="Select reason"
                                    small
                                  />
                                </div>

                                {roundForm.reason === 'Others' && (
                                  <div>
                                    <label className="mb-1 block text-[0.76rem] font-semibold text-[#92400e]">
                                      Custom Reason <span className="text-[#dc2626]">*</span>
                                    </label>
                                    <Input
                                      value={roundForm.custom_reason || ''}
                                      onChange={(e) => setRoundForm({ ...roundForm, custom_reason: e.target.value })}
                                      placeholder="Type custom reason…"
                                      className="h-8 text-[0.82rem]"
                                    />
                                  </div>
                                )}

                                {/* If Rescheduled: prompt for new date/time */}
                                {roundForm.status === 'Rescheduled' && (
                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#fde68a]">
                                    <div>
                                      <label className="mb-1 block text-[0.76rem] font-semibold text-[#92400e]">
                                        Reschedule Date <span className="text-[#dc2626]">*</span>
                                      </label>
                                      <Input
                                        type="date"
                                        value={roundForm.reschedule_date || ''}
                                        onChange={(e) => setRoundForm({ ...roundForm, reschedule_date: e.target.value })}
                                        className="h-8 text-[0.82rem]"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[0.76rem] font-semibold text-[#92400e]">
                                        Reschedule Time
                                      </label>
                                      <Input
                                        type="time"
                                        value={roundForm.reschedule_time || ''}
                                        onChange={(e) => setRoundForm({ ...roundForm, reschedule_time: e.target.value })}
                                        className="h-8 text-[0.82rem]"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Reject Reason: mandatory if Result === 'Rejected' */}
                            {roundForm.status === 'Completed' && roundForm.result === 'Rejected' && (
                              <div className="rounded-md bg-[#fef2f2] p-3 border border-[#fecaca]">
                                <label className="mb-1 block text-[0.76rem] font-semibold text-[#b91c1c]">
                                  Rejection Reason <span className="text-[#dc2626]">*</span>
                                </label>
                                <Input
                                  value={roundForm.reject_reason || ''}
                                  onChange={(e) => setRoundForm({ ...roundForm, reject_reason: e.target.value })}
                                  placeholder="Specify rejection reason…"
                                  className="h-8 text-[0.82rem]"
                                />
                                <span className="mt-1 block text-[0.7rem] text-[#b91c1c]">
                                  Warning: Rejecting this round will automatically cancel/clear subsequent rounds and mark candidate as rejected.
                                </span>
                              </div>
                            )}

                            {/* Comments */}
                            <div>
                              <label className="mb-1 block text-[0.76rem] font-semibold text-[#475569]">
                                Comments / Notes
                              </label>
                              <Textarea
                                rows={2}
                                value={roundForm.comments || ''}
                                onChange={(e) => setRoundForm({ ...roundForm, comments: e.target.value })}
                                placeholder="Additional interview notes / feedback…"
                                className="text-[0.82rem]"
                              />
                            </div>

                            {/* Error text */}
                            {formError && (
                              <div className="rounded bg-[#fee2e2] px-3 py-1.5 text-[0.76rem] text-[#b91c1c]">
                                {formError}
                              </div>
                            )}

                            {/* Form Action buttons */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingRoundOrder(null)}
                                disabled={saveMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSave(round.round_order)}
                                disabled={saveMutation.isPending}
                              >
                                {saveMutation.isPending ? 'Saving…' : 'Save Round'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3">
          <span className="text-[0.74rem] text-[#64748b]">
            Interviews follow strict top-down progression. Round N+1 unlocks upon Round N selection.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
