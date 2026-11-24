'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RemarkDialog } from './RemarkDialog';
import { DEMAND_LIFECYCLE_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';
import {
  useChangeDemandStatusMutation,
  useCloseDemandMutation,
} from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import type { Demand, DemandOnboarding } from '@/components/types';
import { formatDateTime } from '@/lib/utils';

interface DemandActionsBarProps {
  demand: Demand;
  onboardings: DemandOnboarding[];
  canManage: boolean;
  /** Clone Demand — only rendered for an already-Closed Demand (the parent view gates it
   *  on canCloneDemand, and the backend re-checks ownership regardless). */
  onCloneRequest?: () => void;
}

type PendingAction =
  | { type: 'change_status'; to_status: string; requiresRemark: boolean; title: string }
  | { type: 'hold' }
  | { type: 'cancel' }
  | { type: 'reopen' }
  | { type: 'resume' };

function errorMessageFrom(err: unknown, fallback: string): string {
  if (isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

/**
 * The demand's action bar: forward status move, status dropdown, Hold/Resume,
 * Cancel/Reopen, Close Demand, Clone Demand, and a "Status timeline" button that opens
 * the event history in a modal.
 *
 * All of the status mutation logic (remark capture, reversal detection, closure feedback)
 * is carried over unchanged from the former Overview tab — this component only changes
 * WHERE it renders. The timeline is fetched lazily, only once the modal is opened.
 */
export function DemandActionsBar({ demand, onboardings, canManage, onCloneRequest }: DemandActionsBarProps) {
  const requestId = demand.request_id;
  const changeStatusMutation = useChangeDemandStatusMutation(requestId);
  const closeDemandMutation = useCloseDemandMutation(requestId);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [closureFeedback, setClosureFeedback] = useState('');
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingClosureOnboardings = useMemo(
    () => onboardings.filter((o) => o.closure_due_at && !o.closed_at && new Date(o.closure_due_at) <= new Date()),
    [onboardings]
  );

  const isOnHold = demand.status === 'On Hold';
  const isCancelled = demand.status === 'Cancelled';

  const isReversal = (to: string) => {
    const fromIdx = DEMAND_LIFECYCLE_STATUS_VALUES.indexOf(demand.status as never);
    const toIdx = DEMAND_LIFECYCLE_STATUS_VALUES.indexOf(to as never);
    if (fromIdx === -1 || toIdx === -1) return false;
    return toIdx < fromIdx;
  };

  const runStatusChange = (to_status: string, remark: string) => {
    setActionError(null);
    changeStatusMutation.mutate(
      { to_status, remark: remark || undefined },
      {
        onSuccess: () => setPendingAction(null),
        onError: (err) => setActionError(errorMessageFrom(err, 'Failed to change status')),
      }
    );
  };

  const runClose = (remark: string) => {
    setActionError(null);
    closeDemandMutation.mutate(
      { closure_feedback: closureFeedback.trim(), remark: remark || undefined },
      {
        onSuccess: () => {
          setPendingAction(null);
          setShowClosureForm(false);
          setClosureFeedback('');
        },
        onError: (err) => setActionError(errorMessageFrom(err, 'Failed to close demand')),
      }
    );
  };

  const nextForwardStatus = () => {
    const idx = DEMAND_LIFECYCLE_STATUS_VALUES.indexOf(demand.status as never);
    if (idx === -1 || idx >= DEMAND_LIFECYCLE_STATUS_VALUES.length - 1) return null;
    return DEMAND_LIFECYCLE_STATUS_VALUES[idx + 1];
  };
  const forwardTarget = nextForwardStatus();

  return (
    <>
      {pendingClosureOnboardings.length > 0 && !isCancelled && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#d97706]" />
            <div>
              <div className="text-[0.85rem] font-bold text-[#92400e]">Closure Pending Feedback</div>
              <div className="text-[0.78rem] text-[#b45309]">
                {pendingClosureOnboardings.length} candidate{pendingClosureOnboardings.length > 1 ? 's' : ''} joined 90+ days ago. Confirm closure feedback to close this demand.
              </div>
            </div>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setShowClosureForm(true)} className="shrink-0 bg-[#d97706] text-white hover:bg-[#d97706]/90">
              Review & Close
            </Button>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--card-border)] bg-white px-4 py-3 shadow-[var(--card-shadow)]">
          {forwardTarget && !isOnHold && !isCancelled && (
            <Button
              size="sm"
              onClick={() => setPendingAction({ type: 'change_status', to_status: forwardTarget, requiresRemark: false, title: `Move to ${forwardTarget}` })}
              className="gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Move to {forwardTarget}
            </Button>
          )}

          {!isOnHold && !isCancelled && (
            <Select
              value=""
              onValueChange={(to) => {
                if (!to) return;
                setPendingAction({ type: 'change_status', to_status: to, requiresRemark: isReversal(to), title: `Change status to ${to}` });
              }}
            >
              <SelectTrigger className="h-auto w-[210px] rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.8rem] text-[#334155] shadow-none">
                <SelectValue placeholder="Change status to…" />
              </SelectTrigger>
              <SelectContent>
                {DEMAND_LIFECYCLE_STATUS_VALUES.filter((s) => s !== demand.status).map((s) => (
                  <SelectItem key={s} value={s}>
                    {demandStatusLabel(s)}{isReversal(s) ? ' (reversal — remark required)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isOnHold && !isCancelled && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction({ type: 'hold' })} className="gap-1.5">
              <PauseCircle className="h-3.5 w-3.5" /> Hold
            </Button>
          )}
          {isOnHold && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction({ type: 'resume' })} className="gap-1.5">
              <PlayCircle className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {!isCancelled && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction({ type: 'cancel' })} className="gap-1.5 border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2]">
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          {isCancelled && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction({ type: 'reopen' })} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </Button>
          )}
          {demand.status !== 'Closure' && !isCancelled && (
            <Button size="sm" variant="outline" onClick={() => setShowClosureForm(true)} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Close Demand
            </Button>
          )}
          {demand.status === 'Closure' && onCloneRequest && (
            <Button size="sm" variant="outline" onClick={onCloneRequest} className="gap-1.5 border-[#c7d2fe] text-[#4338ca] hover:bg-[#eef2ff]">
              <Copy className="h-3.5 w-3.5" /> Clone Demand
            </Button>
          )}
        </div>
      )}

      {pendingAction?.type === 'change_status' && (
        <RemarkDialog
          title={pendingAction.title}
          remarkRequired={pendingAction.requiresRemark}
          confirmLabel="Confirm"
          isSubmitting={changeStatusMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={(remark) => runStatusChange(pendingAction.to_status, remark)}
        />
      )}
      {pendingAction?.type === 'hold' && (
        <RemarkDialog
          title="Put Demand On Hold"
          remarkRequired
          confirmLabel="Put On Hold"
          isSubmitting={changeStatusMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={(remark) => runStatusChange('On Hold', remark)}
        />
      )}
      {pendingAction?.type === 'resume' && (
        <RemarkDialog
          title="Resume Demand"
          description="Returns the demand to the status it held before being put On Hold."
          remarkRequired
          confirmLabel="Resume"
          isSubmitting={changeStatusMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={(remark) => runStatusChange('Resume', remark)}
        />
      )}
      {pendingAction?.type === 'cancel' && (
        <RemarkDialog
          title="Cancel Demand"
          remarkRequired
          confirmLabel="Cancel Demand"
          confirmVariant="destructive"
          isSubmitting={changeStatusMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={(remark) => runStatusChange('Cancelled', remark)}
        />
      )}
      {pendingAction?.type === 'reopen' && (
        <RemarkDialog
          title="Reopen Demand"
          remarkRequired
          confirmLabel="Reopen"
          isSubmitting={changeStatusMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={(remark) => runStatusChange('Assign', remark)}
        />
      )}

      {showClosureForm && (
        <RemarkDialog
          title="Close Demand"
          description={
            <div className="flex flex-col gap-2">
              <span>{pendingClosureOnboardings.length > 0
                ? `${pendingClosureOnboardings.length} candidate(s) are past their 90-day closure window. Provide closure feedback below.`
                : 'No candidates are past their closure window yet — closure feedback will not apply until at least one is.'}</span>
              <div>
                <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Closure Feedback <span className="text-[#dc2626]">*</span></label>
                <textarea
                  rows={3}
                  value={closureFeedback}
                  onChange={(e) => setClosureFeedback(e.target.value)}
                  placeholder="Summarize the outcome of this demand…"
                  className="w-full resize-y rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
                />
              </div>
            </div>
          }
          remarkRequired={false}
          confirmLabel="Close Demand"
          isSubmitting={closeDemandMutation.isPending}
          errorMessage={actionError}
          onClose={() => { setShowClosureForm(false); setActionError(null); }}
          onConfirm={(remark) => {
            if (!closureFeedback.trim()) {
              setActionError('Closure feedback is required');
              return;
            }
            runClose(remark);
          }}
        />
      )}
    </>
  );
}