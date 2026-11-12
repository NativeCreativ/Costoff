'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CandidateForm } from './CandidateForm';
import { CandidateFormValues } from './candidate.schema';

export type CandidateFormState = CandidateFormValues;

interface CandidateFormModalProps {
  candidateForm: CandidateFormState;
  setCandidateForm: (v: CandidateFormState) => void;
  candidateDedupeError: string | null;
  setShowCandidateModal: (v: boolean) => void;
  handleCreateCandidate: (values: CandidateFormState) => void;
  isSubmitting?: boolean;
  /** Rendered above the form — e.g. the Requirement picker a Recruiter/Account Manager must
   *  use when creating from the master Candidates page (they have no demand context otherwise). */
  demandPicker?: ReactNode;
}

export function CandidateFormModal({ candidateForm, setCandidateForm, candidateDedupeError, setShowCandidateModal, handleCreateCandidate, isSubmitting, demandPicker }: CandidateFormModalProps) {
  return (
    <Modal title="Add New Candidate Profile" subtitle="Automatic email & phone deduplication enabled" size="large" onClose={() => setShowCandidateModal(false)} closeDisabled={isSubmitting}>
      {demandPicker && <div className="mb-4">{demandPicker}</div>}
      {candidateDedupeError && (
        <div className="mb-4 rounded-md border border-[#fca5a5] bg-[#fee2e2] p-3 text-[0.82rem] font-semibold text-[#991b1b]">
          {candidateDedupeError}
        </div>
      )}
      <CandidateForm
        defaultValues={candidateForm}
        onSubmit={(values) => { setCandidateForm(values); handleCreateCandidate(values); }}
        onCancel={() => setShowCandidateModal(false)}
        submitLabel="Save Candidate Profile"
        pendingLabel="Creating…"
        isSubmitting={isSubmitting}
        idFieldsReadOnlyPlaceholders
      />
    </Modal>
  );
}
