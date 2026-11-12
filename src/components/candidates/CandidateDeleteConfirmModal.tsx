'use client';

import { Candidate } from '../types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface CandidateDeleteConfirmModalProps {
  deletingCandidate: Candidate;
  onCancel: () => void;
  onConfirm: (id: string) => void;
  isDeleting?: boolean;
}

export function CandidateDeleteConfirmModal({ deletingCandidate, onCancel, onConfirm, isDeleting }: CandidateDeleteConfirmModalProps) {
  return (
    <Modal title="Delete Candidate" subtitle="This action cannot be undone" width="440px" onClose={onCancel} closeDisabled={isDeleting}>
      <div className="flex flex-col gap-4">
        <p className="text-[0.88rem] text-[#334155]">
          Permanently delete <strong className="font-semibold text-[#0f172a]">{deletingCandidate.full_name}</strong>
          {deletingCandidate.email ? <> ({deletingCandidate.email})</> : null}?
        </p>
        <p className="text-[0.8rem] text-[#64748b]">
          This erases the profile and every submission, interview, offer, onboarding and timeline
          event tied to it — it cannot be recovered. Candidates in a live pipeline cannot be
          deleted; close or cancel the workflow first.
        </p>
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
            disabled={isDeleting}
            onClick={() => onConfirm(deletingCandidate.id)}
            className="h-auto rounded-md bg-[#dc2626] px-4 py-2 font-semibold text-white hover:bg-[#dc2626]/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete Candidate'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
