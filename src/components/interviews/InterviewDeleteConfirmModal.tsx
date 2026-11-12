'use client';

import { Interview } from '../types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { normalizeInterviewResult } from '@/lib/auth/interviewPermissions';

interface InterviewDeleteConfirmModalProps {
  deletingInterview: Interview;
  onCancel: () => void;
  onConfirm: (id: string) => void;
  isDeleting?: boolean;
  /** Set when the delete attempt was blocked server-side (e.g. the result changed to pass
   *  in another tab) — shown inline instead of a native browser alert(), to match the rest
   *  of the app's UI. */
  error?: string | null;
}

export function InterviewDeleteConfirmModal({ deletingInterview, onCancel, onConfirm, isDeleting, error }: InterviewDeleteConfirmModalProps) {
  // The same rule the row's Delete button uses — a `pass` result blocks deletion. Known
  // upfront from the interview's own result, so nothing is sent to the server until the user
  // actually confirms.
  const blockedByResult = normalizeInterviewResult(deletingInterview.result) === 'pass';
  const blockedMessage = error || (blockedByResult ? 'A passed interview cannot be deleted.' : null);

  return (
    <Modal title="Delete Interview" width="440px" onClose={onCancel} closeDisabled={isDeleting}>
      <div className="flex flex-col gap-4">
        <p className="text-[0.88rem] text-[#334155]">
          Delete this interview
          {deletingInterview.candidate_name ? <> for <strong className="font-semibold text-[#0f172a]">{deletingInterview.candidate_name}</strong></> : null}
          {deletingInterview.demand_request_id ? <> ({deletingInterview.demand_request_id})</> : null}? This cannot be undone.
        </p>
        <p className="text-[0.8rem] text-[#64748b]">
          This erases the interview record and its feedback/result — it cannot be recovered.
        </p>
        {blockedMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] text-red-700">
            {blockedMessage}
          </div>
        )}
        <div className="flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isDeleting || blockedByResult}
            title={blockedByResult ? 'A passed interview cannot be deleted' : undefined}
            onClick={() => onConfirm(deletingInterview.id)}
            className="h-auto rounded-md bg-[#dc2626] px-4 py-2 font-semibold text-white hover:bg-[#dc2626]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}