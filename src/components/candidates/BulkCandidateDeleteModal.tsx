'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBulkDeleteCandidatesMutation } from '@/queries/candidates/useCandidateMutations';
import type { BulkCandidateResult } from '@/services/candidate.service';

interface BulkCandidateDeleteModalProps {
  /** Every selected candidate, paired with whether it's actually eligible to delete
   *  (same canEditCandidate check the row's own Delete button uses — the server also
   *  re-checks the "not in a live workflow" archive-blocker, which isn't knowable
   *  client-side) and its display label. */
  items: { id: string; label: string; eligible: boolean }[];
  onClose: () => void;
  onDone: () => void;
}

export function BulkCandidateDeleteModal({ items, onClose, onDone }: BulkCandidateDeleteModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCandidateResult | null>(null);
  const mutation = useBulkDeleteCandidatesMutation();

  const eligible = items.filter((i) => i.eligible);
  const ineligible = items.filter((i) => !i.eligible);

  const handleSubmit = () => {
    setError(null);
    if (eligible.length === 0) return;
    mutation.mutate(eligible.map((i) => i.id), {
      onSuccess: (res) => setResult(res),
      onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Bulk delete failed' : 'Bulk delete failed'),
    });
  };

  return (
    <Modal title={`Bulk Delete (${items.length} candidate${items.length > 1 ? 's' : ''} selected)`} onClose={result ? onDone : onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="text-[0.85rem] font-semibold text-[#0f172a]">
            {result.successCount} deleted, {result.failureCount} failed.
          </div>
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {result.results.map((r) => (
              <div key={r.candidate_id} className="flex items-center justify-between rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
                <span>{items.find((i) => i.id === r.candidate_id)?.label || r.candidate_id}</span>
                {r.success ? (
                  <Badge className="border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Deleted</Badge>
                ) : (
                  <span className="text-[0.72rem] text-[#dc2626]">{r.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">
              Eligible for deletion ({eligible.length} of {items.length})
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
              {eligible.length === 0 ? (
                <span className="text-[0.78rem] text-[#94a3b8]">None of the selected candidates are eligible.</span>
              ) : (
                eligible.map((i) => (
                  <Badge key={i.id} className="border-transparent bg-white text-[0.7rem] font-semibold text-[#475569] hover:bg-white">
                    {i.label}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {ineligible.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
              {ineligible.length} selected candidate{ineligible.length > 1 ? 's are' : ' is'} not eligible and will be skipped — you can only delete a candidate you own, and not while it's still in a live workflow.
            </div>
          )}

          <p className="text-[0.8rem] text-[#64748b]">
            This permanently deletes each eligible candidate, along with every submission,
            interview, offer and onboarding tied to it — it cannot be recovered.
          </p>

          {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={eligible.length === 0 || mutation.isPending}
              className="bg-[#dc2626] hover:bg-[#dc2626]/90"
            >
              {mutation.isPending ? 'Deleting…' : `Delete ${eligible.length} Candidate${eligible.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
