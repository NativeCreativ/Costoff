'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CandidateForm } from '@/components/candidates/CandidateForm';
import { candidateToFormState } from '@/components/candidates/candidateFormDefaults';
import type { CandidateFormValues } from '@/components/candidates/candidate.schema';
import { useCandidateHistoryQuery } from '@/queries/candidates/useCandidateHistoryQuery';
import { updateCandidate } from '@/services/candidate.service';
import { useAddCallToSourcingMutation } from '@/queries/demandFulfillment/useCallLogAndInstructions';
import type { Candidate } from '@/components/types';

interface CompleteCallCandidateModalProps {
  requestId: string;
  callId: string;
  candidateId: string;
  skillGroupId?: string | null;
  /** From the call log: may this user edit the candidate profile? */
  canEditCandidate: boolean;
  onClose: () => void;
}

/**
 * Demand Match follow-up: the candidate's full Add/Edit form, pre-filled from what the call
 * captured. Saving updates the profile and lists the candidate in this demand's Sourcing (as a
 * saved profile, ready to submit). A user who may not edit someone else's profile can still put
 * it into Sourcing as it is.
 */
export function CompleteCallCandidateModal({ requestId, callId, candidateId, skillGroupId, canEditCandidate, onClose }: CompleteCallCandidateModalProps) {
  const toast = useToast();
  const history = useCandidateHistoryQuery(candidateId, true);
  const addToSourcing = useAddCallToSourcingMutation(requestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyData = history.data as { candidate?: Candidate; can_edit?: boolean } | undefined;
  const candidate = historyData?.candidate;
  // The server's answer wins over the hint passed in (a reopened Demand Match has no hint).
  const canEdit = historyData?.can_edit ?? canEditCandidate;

  const finish = () =>
    addToSourcing.mutate(callId, {
      onSuccess: (res) => {
        if (res.already_in_pipeline) toast.success('Saved', 'This candidate is already in the pipeline.');
        else toast.success('Added to Sourcing', 'Submit the profile from the Sourcing tab when it is ready.');
        onClose();
      },
    });

  const save = async (values: CandidateFormValues) => {
    setSaving(true);
    setError(null);
    try {
      await updateCandidate(candidateId, values);
      finish();
    } catch (e) {
      setError(isAxiosError(e) ? e.response?.data?.error || 'Could not save the candidate' : 'Could not save the candidate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Demand Match — complete the candidate"
      subtitle="Fill in what you know. Saving lists the candidate in Sourcing for this demand."
      size="large"
      onClose={onClose}
      closeDisabled={saving || addToSourcing.isPending}
    >
      {history.isLoading || !candidate ? (
        history.isError ? <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the candidate.</p> : <Loader message="Loading the candidate…" />
      ) : canEdit ? (
        <>
          {error && <div className="mb-3 rounded-md border border-[#fca5a5] bg-[#fee2e2] p-3 text-[0.82rem] font-semibold text-[#991b1b]">{error}</div>}
          <CandidateForm
            defaultValues={{
              ...candidateToFormState(candidate),
              skills_category_id: skillGroupId || candidate.skills_category_id || '',
            }}
            onSubmit={save}
            onCancel={onClose}
            submitLabel="Save & add to Sourcing"
            pendingLabel="Saving…"
            isSubmitting={saving || addToSourcing.isPending}
            savedCandidate={candidate}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3 text-[0.85rem] text-[#334155]">
          <p>
            <strong>{candidate.full_name}</strong> is an existing profile that someone else manages, so you can&apos;t edit it here.
            You can still add them to this demand&apos;s Sourcing as they are.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Later</Button>
            <Button type="button" onClick={finish} disabled={addToSourcing.isPending}>{addToSourcing.isPending ? 'Adding…' : 'Add to Sourcing'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
