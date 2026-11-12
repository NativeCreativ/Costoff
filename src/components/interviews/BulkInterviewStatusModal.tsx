'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  INTERVIEW_COMPLETED_STATUS,
  INTERVIEW_RESULT_OPTIONS,
} from '@/constants/options';
import { useInterviewStatusOptions } from '@/components/interviews/useInterviewStatusOptions';
import { useBulkChangeInterviewStatusMutation } from '@/queries/interviews/useInterviewMutations';
import type { BulkInterviewResult } from '@/services/interview.service';

/** One selected row, pre-resolved by the shared getInterviewRowActions() helper. */
export interface BulkStatusItem {
  id: string;
  label: string;
  /** False when the row may not be edited (role gate or the interview's status is Completed). */
  eligible: boolean;
  reason: string | null;
}

interface BulkInterviewStatusModalProps {
  items: BulkStatusItem[];
  onClose: () => void;
  /** Receives the ids that were NOT applied, so the caller can keep those rows selected. */
  onDone: (keptIds: string[]) => void;
}

/** No remark field — unlike the Demand bulk-status modal, which requires one. */
export function BulkInterviewStatusModal({ items, onClose, onDone }: BulkInterviewStatusModalProps) {
  const { transition: transitionStatusOptions } = useInterviewStatusOptions();
  const [toStatus, setToStatus] = useState('');
  const [toResult, setToResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkInterviewResult | null>(null);

  const mutation = useBulkChangeInterviewStatusMutation();

  const eligible = items.filter((i) => i.eligible);
  const skipped = items.filter((i) => !i.eligible);

  // Completing needs the outcome; No-Show needs nothing further.
  const needsResult = toStatus === INTERVIEW_COMPLETED_STATUS;
  const isFormValid = !!toStatus && (!needsResult || !!toResult);

  const handleStatusChange = (value: string) => {
    setToStatus(value);
    setToResult('');
  };

  const handleSubmit = () => {
    setError(null);
    if (!isFormValid || eligible.length === 0) return;
    // Only the eligible ids are sent — there is no bulk bypass of the per-row rule, and the
    // server re-checks each one anyway.
    mutation.mutate(
      {
        interviewIds: eligible.map((i) => i.id),
        status: toStatus,
        result: needsResult ? toResult : undefined,
      },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Bulk update failed' : 'Bulk update failed'),
      }
    );
  };

  /** Rows that were never applied stay selected so the user can act on them individually. */
  const handleDone = () => {
    const failedIds = (result?.results ?? []).filter((r) => !r.success).map((r) => r.interview_id);
    onDone([...new Set([...skipped.map((i) => i.id), ...failedIds])]);
  };

  return (
    <Modal title={`Bulk Change Status (${items.length} interview${items.length > 1 ? 's' : ''})`} onClose={result ? handleDone : onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="text-[0.85rem] font-semibold text-[#0f172a]">
            {result.successCount} updated, {skipped.length + result.failureCount} skipped.
          </div>

          {skipped.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.8rem] text-[#92400e]">
              {skipped.length} selected interview{skipped.length > 1 ? 's were' : ' was'} skipped before sending
              {skipped.length === 1 ? ' — ' : ' — '}
              <span className="font-semibold">{skipped[0].reason}</span>.
              {skipped.length > 1 ? ' The list below shows each reason.' : ''}
            </div>
          )}

          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {skipped.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
                <span className="truncate">{i.label}</span>
                <span className="shrink-0 text-[0.72rem] text-[#92400e]">Skipped — {i.reason}</span>
              </div>
            ))}
            {result.results.map((r) => (
              <div key={r.interview_id} className="flex items-center justify-between gap-3 rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
                <span className="truncate">{items.find((i) => i.id === r.interview_id)?.label || r.interview_id}</span>
                {r.success ? (
                  <Badge className="shrink-0 border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Updated</Badge>
                ) : (
                  <span className="shrink-0 text-[0.72rem] text-[#dc2626]">{r.error}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.75rem] text-[#64748b]">Skipped rows stay selected.</span>
            <Button onClick={handleDone}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">
              Will be updated ({eligible.length} of {items.length})
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
              {eligible.length === 0 ? (
                <span className="text-[0.78rem] text-[#94a3b8]">None of the selected interviews can be updated.</span>
              ) : (
                eligible.map((i) => (
                  <Badge key={i.id} className="border-transparent bg-white text-[0.7rem] font-semibold text-[#475569] hover:bg-white">
                    {i.label}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {skipped.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
              {skipped.length} selected interview{skipped.length > 1 ? 's will' : ' will'} be skipped and stay selected
              {skipped.length === 1 ? <> — {skipped[0].reason}.</> : '. Each reason is listed below.'}
              <div className="mt-1.5 flex flex-col gap-1">
                {skipped.map((i) => (
                  <span key={i.id} className="text-[0.74rem]">
                    • {i.label} — {i.reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          <FormSelect
            label="New Status"
            required
            placeholder="Select status…"
            options={transitionStatusOptions}
            value={toStatus}
            onChange={handleStatusChange}
          />

          {needsResult && (
            <FormSelect
              label="Result"
              required
              placeholder="Select result…"
              options={INTERVIEW_RESULT_OPTIONS}
              value={toResult}
              onChange={setToResult}
            />
          )}

          {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || eligible.length === 0 || mutation.isPending}>
              {mutation.isPending ? 'Applying…' : `Apply to ${eligible.length}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}