'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UserSelect } from '@/components/ui/UserSelect';
import { useAmProfilesQuery } from '@/queries/demands/useAmProfilesQuery';
import { useSpocProfilesQuery } from '@/queries/demands/useSpocProfilesQuery';
import { useRecruiterProfilesQuery } from '@/queries/demands/useRecruiterProfilesQuery';
import { useAssignDemandMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import type { Demand, DemandAssignment } from '@/components/types';

interface DemandAssignModalProps {
  requestId: string;
  demand: Demand;
  currentAssignments: DemandAssignment[];
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
}

export function DemandAssignModal({ requestId, demand, currentAssignments, currentUserId, currentUserRole, onClose }: DemandAssignModalProps) {
  const amProfiles = useAmProfilesQuery();
  const spocProfiles = useSpocProfilesQuery();
  const recruiterProfiles = useRecruiterProfilesQuery();
  const assignMutation = useAssignDemandMutation(requestId);

  // Only Super Admin may reassign the Account Manager; an AM's own ownership stays
  // fixed and the selector is hidden for them entirely.
  const isAccountManagerActor = currentUserRole === 'account_manager';
  const showAmSelector = !isAccountManagerActor;

  const currentAm = currentAssignments.find((a) => a.role_in_demand === 'account_manager' && a.is_active)?.user_id
    || demand.contact_profile_id
    || '';
  const currentSpoc = currentAssignments.find((a) => a.role_in_demand === 'spoc' && a.is_active)?.user_id
    || demand.spoc_profile_id
    || '';
  // demand_assignments is an append-only history log (every save adds rows without
  // deactivating old ones), so it is NOT the current-state source for recruiters —
  // demand.recruiter_ids (from demand_ta_allocations, the actual FK table) is.
  const currentRecruiters = Array.from(new Set(demand.recruiter_ids ?? []));

  const [am, setAm] = useState(currentAm);
  const [spoc, setSpoc] = useState(currentSpoc);
  const [recruiters, setRecruiters] = useState<string[]>(currentRecruiters);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amOptions = amProfiles.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: 'AM' }));
  const spocOptions = spocProfiles.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email, role: 'SPOC' }));
  const recruiterOptions = recruiterProfiles.data.map((p) => ({ id: p.id, name: p.full_name, email: p.email }));

  const handleSubmit = () => {
    setError(null);
    if (!am && !spoc && recruiters.length === 0) {
      setError('Select at least one assignee (Account Manager, SPOC, or recruiter)');
      return;
    }
    const assignments = [
      ...(showAmSelector && am ? [{ user_id: am, role_in_demand: 'account_manager' as const }] : []),
      ...(spoc ? [{ user_id: spoc, role_in_demand: 'spoc' as const }] : []),
      ...recruiters.map((id) => ({ user_id: id, role_in_demand: 'recruiter' as const })),
    ];

    assignMutation.mutate(
      { assignments, remark: remark.trim() || undefined },
      {
        onSuccess: onClose,
        onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to assign' : 'Failed to assign'),
      }
    );
  };

  return (
    <Modal title="Assign / Reassign Demand" subtitle="Assign the Account Manager, SPOC, and recruiter(s) for this demand." onClose={onClose} closeDisabled={assignMutation.isPending}>
      <div className="flex flex-col gap-4">
        {showAmSelector && (
          <UserSelect
            mode="single"
            label="Account Manager"
            placeholder="Select Account Manager…"
            options={amOptions}
            value={am}
            onChange={setAm}
            isLoading={amProfiles.isLoading}
          />
        )}
        <UserSelect
          mode="single"
          label="SPOC"
          placeholder="Select SPOC (optional)…"
          options={spocOptions}
          value={spoc}
          onChange={setSpoc}
          isLoading={spocProfiles.isLoading}
        />
        <UserSelect
          mode="multiple"
          label="Recruiter(s)"
          placeholder="Select recruiter(s)…"
          options={recruiterOptions}
          value={recruiters}
          onChange={setRecruiters}
          isLoading={recruiterProfiles.isLoading}
        />
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Remark (optional)</label>
          <Textarea
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Reason for this assignment…"
            className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
          />
        </div>

        {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={assignMutation.isPending}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={assignMutation.isPending}>
            {assignMutation.isPending ? 'Saving…' : 'Save Assignment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
