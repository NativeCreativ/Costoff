'use client';

import { Candidate } from '../types';
import { CandidateFormState } from './CandidateFormModal';
import { Modal } from '@/components/ui/Modal';
import { CandidateForm } from './CandidateForm';

interface CandidateEditModalProps {
  editingCandidate: Candidate;
  candidateForm: CandidateFormState;
  setCandidateForm: (v: CandidateFormState) => void;
  editCandidateStage: string;
  setEditCandidateStage: (v: string) => void;
  setShowEditCandidateModal: (v: boolean) => void;
  setEditingCandidate: (v: Candidate | null) => void;
  handleUpdateCandidate: (values: CandidateFormState) => void;
  candidateDedupeError?: string | null;
  isSubmitting?: boolean;
}

export function CandidateEditModal({
  editingCandidate, candidateForm, setCandidateForm, editCandidateStage, setEditCandidateStage,
  setShowEditCandidateModal, setEditingCandidate, handleUpdateCandidate, candidateDedupeError, isSubmitting
}: CandidateEditModalProps) {
  const close = () => { setShowEditCandidateModal(false); setEditingCandidate(null); };

  return (
    <Modal title={`Update Candidate — ${editingCandidate.full_name}`} subtitle="Update pipeline stage tag and candidate profile" size="large" onClose={close} closeDisabled={isSubmitting}>
      {candidateDedupeError && (
        <div className="mb-4 rounded-md border border-[#fca5a5] bg-[#fee2e2] p-3 text-[0.82rem] font-semibold text-[#991b1b]">
          {candidateDedupeError}
        </div>
      )}
      <CandidateForm
        defaultValues={candidateForm}
        onSubmit={(values) => { setCandidateForm(values); handleUpdateCandidate(values); }}
        onCancel={close}
        submitLabel="Save Candidate Updates"
        pendingLabel="Saving…"
        isSubmitting={isSubmitting}
        // extraContent={
        //   <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3.5">
        //     <label className="mb-1.5 block text-[0.82rem] font-bold text-[#1e40af]">Current Pipeline Stage Tag (27 Stages)</label>
        //     <select value={editCandidateStage} onChange={(e) => setEditCandidateStage(e.target.value)} className="w-full rounded-md border border-[#93c5fd] bg-white px-3 py-2.5 text-[0.85rem] font-semibold text-[#1e3a8a]">
        //       <option value="Sourced">Sourced</option>
        //       <option value="Submitted to AM">Submitted to AM</option>
        //       <option value="Submitted to Client">Submitted to Client</option>
        //       <option value="Shortlisted">Shortlisted</option>
        //       <option value="L1 Interview Scheduled">L1 Interview Scheduled</option>
        //       <option value="L1 Interview Cleared">L1 Interview Cleared</option>
        //       <option value="L2 Interview Scheduled">L2 Interview Scheduled</option>
        //       <option value="L2 Interview Cleared">L2 Interview Cleared</option>
        //       <option value="Client Selected">Client Selected</option>
        //       <option value="Offer Released">Offer Released</option>
        //       <option value="Offer Accepted">Offer Accepted</option>
        //       <option value="BGV In Progress">BGV In Progress</option>
        //       <option value="Joined">Joined</option>
        //       <option value="Rejected">Rejected</option>
        //       <option value="Candidate Backout">Candidate Backout</option>
        //     </select>
        //   </div>
        // }
      />
    </Modal>
  );
}
