'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CandidateForm } from '@/components/candidates/CandidateForm';
import { candidateToFormState } from '@/components/candidates/candidateFormDefaults';
import type { CandidateFormValues } from '@/components/candidates/candidate.schema';
import { useCandidateHistoryQuery } from '@/queries/candidates/useCandidateHistoryQuery';
import { updateCandidate } from '@/services/candidate.service';
import { queryKeys } from '@/lib/queryKeys';
import type { Candidate } from '@/components/types';

interface SourcedCandidateModalProps {
  requestId: string;
  candidateId: string;
  /** Saved or rejected profiles may be edited; a submitted one is shown read-only. */
  editable: boolean;
  onClose: () => void;
}

/**
 * View / edit a Sourcing profile's candidate details — before it is submitted, and after the
 * AM / SPOC rejects it (review batch 3-4). Editing still needs the candidate edit right
 * (canEditCandidate, answered by the server as `can_edit`).
 */
export function SourcedCandidateModal({ requestId, candidateId, editable, onClose }: SourcedCandidateModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const history = useCandidateHistoryQuery(candidateId, true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = history.data as { candidate?: Candidate; can_edit?: boolean } | undefined;
  const candidate = data?.candidate;
  const canEdit = editable && !!data?.can_edit;

  const save = async (values: CandidateFormValues) => {
    setSaving(true);
    setError(null);
    try {
      await updateCandidate(candidateId, values);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lifecycle(requestId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.candidateHistory(candidateId) }),
        queryClient.invalidateQueries({ queryKey: ['candidates'] }),
      ]);
      toast.success('Candidate updated');
      onClose();
    } catch (e) {
      setError(isAxiosError(e) ? e.response?.data?.error || 'Could not save the candidate' : 'Could not save the candidate');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value?: string | number | null) => (
    <div className="text-[0.82rem]"><span className="font-semibold text-[#475569]">{label}:</span> {value || '—'}</div>
  );

  return (
    <Modal title={candidate ? candidate.full_name : 'Candidate'} subtitle={canEdit ? 'Update the details, then submit from Sourcing.' : 'Candidate details'} size="large" onClose={onClose} closeDisabled={saving}>
      {history.isLoading || !candidate ? (
        history.isError ? <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the candidate.</p> : <Loader message="Loading the candidate…" />
      ) : canEdit ? (
        <>
          {error && <div className="mb-3 rounded-md border border-[#fca5a5] bg-[#fee2e2] p-3 text-[0.82rem] font-semibold text-[#991b1b]">{error}</div>}
          <CandidateForm
            defaultValues={candidateToFormState(candidate)}
            onSubmit={save}
            onCancel={onClose}
            submitLabel="Save details"
            pendingLabel="Saving…"
            isSubmitting={saving}
            savedCandidate={candidate}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {field('Email', candidate.email)}
            {field('Mobile', candidate.phone)}
            {field('Current company', candidate.current_company)}
            {field('Designation', candidate.current_designation)}
            {field('Total experience', candidate.total_experience)}
            {field('Relevant experience', candidate.relevant_experience)}
            {field('Location', candidate.current_location)}
            {field('Notice period', candidate.availability)}
            {field('Current CTC', candidate.current_ctc)}
            {field('Expected CTC', candidate.expected_ctc)}
            {field('Skills', (candidate.skills ?? []).join(', '))}
            {field('Source', candidate.source)}
          </div>
          {candidate.resume_url && (
            <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-[0.82rem] font-semibold text-[#2563eb] hover:underline">
              Open resume{candidate.resume_file_name ? ` (${candidate.resume_file_name})` : ''}
            </a>
          )}
          {candidate.other_details && <div className="whitespace-pre-line text-[0.82rem]"><span className="font-semibold text-[#475569]">Other details:</span> {candidate.other_details}</div>}
          {editable && !data?.can_edit && <p className="text-[0.78rem] text-[#64748b]">You can&apos;t edit this profile: someone else manages it.</p>}
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div>
        </div>
      )}
    </Modal>
  );
}
