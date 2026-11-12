'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBulkDeleteInterviewsMutation } from '@/queries/interviews/useInterviewMutations';
import type { BulkInterviewResult } from '@/services/interview.service';

/** One selected row, pre-resolved by the shared getInterviewRowActions() helper. */
export interface BulkDeleteItem {
  id: string;
  label: string;
  /** False when the row may not be deleted (role gate or the interview's status is Completed). */
  eligible: boolean;
  reason: string | null;
}

interface BulkInterviewDeleteModalProps {
  items: BulkDeleteItem[];
  onClose: () => void;
  /** Receives the ids that were NOT deleted, so the caller can keep those rows selected. */
  onDone: (keptIds: string[]) => void;
}

export function BulkInterviewDeleteModal({ items, onClose, onDone }: BulkInterviewDeleteModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkInterviewResult | null>(null);
  const mutation = useBulkDeleteInterviewsMutation();

  const eligible = items.filter((i) => i.eligible);
  const skipped = items.filter((i) => !i.eligible);

  const handleSubmit = () => {
    setError(null);
    if (eligible.length === 0) return;
    // Only the eligible ids are sent — the per-row rule is never bypassed in bulk, and the
    // server re-checks every one of them anyway.
    mutation.mutate(eligible.map((i) => i.id), {
      onSuccess: (res) => setResult(res),
      onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Bulk delete failed' : 'Bulk delete failed'),
    });
  };

  /** Rows that were not deleted stay selected so the user can act on them individually. */
  const handleDone = () => {
    const failedIds = (result?.results ?? []).filter((r) => !r.success).map((r) => r.interview_id);
    onDone([...new Set([...skipped.map((i) => i.id), ...failedIds])]);
  };

  return (
    <Modal title={`Bulk Delete (${items.length} interview${items.length > 1 ? 's' : ''} selected)`} onClose={result ? handleDone : onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="text-[0.85rem] font-semibold text-[#0f172a]">
            {result.successCount} deleted, {skipped.length + result.failureCount} skipped.
          </div>

          {skipped.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.8rem] text-[#92400e]">
              {skipped.length} interview{skipped.length > 1 ? 's were' : ' was'} skipped
              {skipped.length === 1 ? <> — {skipped[0].reason}.</> : '. Each reason is listed below.'}
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
                  <Badge className="shrink-0 border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Deleted</Badge>
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
          <p className="text-[0.88rem] text-[#334155]">
            Delete {eligible.length} interview{eligible.length === 1 ? '' : 's'}? This cannot be undone.
          </p>

          <div>
            <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">
              Will be deleted ({eligible.length} of {items.length})
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
              {eligible.length === 0 ? (
                <span className="text-[0.78rem] text-[#94a3b8]">None of the selected interviews can be deleted.</span>
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
              {skipped.length} interview{skipped.length > 1 ? 's will' : ' will'} be skipped and stay selected
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

          <p className="text-[0.8rem] text-[#64748b]">
            This permanently deletes each eligible interview and its feedback/result — it cannot be recovered.
          </p>

          {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={eligible.length === 0 || mutation.isPending}
              className="bg-[#dc2626] text-white hover:bg-[#dc2626]/90"
            >
              {mutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}