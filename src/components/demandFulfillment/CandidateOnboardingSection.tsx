'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormSelect } from '@/components/ui/FormSelect';
import { Loader } from '@/components/ui/Loader';
import { formatDate } from '@/lib/utils';
import { useDemandCandidateOnboardingQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useUpdateOnboardingMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { OnboardingStepsSection } from './OnboardingStepsSection';
import { BGV_STATUS_VALUES } from '@/lib/demandFulfillment/constants';

const BGV_OPTIONS = BGV_STATUS_VALUES.map((v) => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

interface CandidateOnboardingSectionProps {
  requestId: string;
  dcId: string;
  canManage: boolean;
}

export function CandidateOnboardingSection({ requestId, dcId, canManage }: CandidateOnboardingSectionProps) {
  const onboardingQuery = useDemandCandidateOnboardingQuery(requestId, dcId);
  const updateMutation = useUpdateOnboardingMutation(requestId, dcId);

  const onboarding = onboardingQuery.data?.onboarding;

  const [bgvRemark, setBgvRemark] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (onboarding?.joined_at) setJoinedAt(onboarding.joined_at.slice(0, 10));
  }, [onboarding?.joined_at]);

  if (onboardingQuery.isLoading) {
    return <Loader message="Loading onboarding record…" size="sm" />;
  }

  if (!onboarding) {
    return (
      <div className="rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">
        This candidate has not entered onboarding yet. The onboarding record is created automatically when the candidate's status changes to "Onboarding".
      </div>
    );
  }

  const handleBgvChange = (status: string) => {
    setError(null);
    updateMutation.mutate(
      { onboardingId: onboarding.id, payload: { bgv_status: status, bgv_remark: bgvRemark || undefined } },
      { onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to update BGV status' : 'Failed to update BGV status') }
    );
  };

  const handleMarkJoined = () => {
    setError(null);
    setWarning(null);
    if (!joinedAt) {
      setError('Joining date is required');
      return;
    }
    updateMutation.mutate(
      { onboardingId: onboarding.id, payload: { joined_at: joinedAt } },
      {
        onSuccess: (res) => setWarning(res.warning),
        onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to mark joined' : 'Failed to mark joined'),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ordered, per-client onboarding steps replace the flat document checklist. Older
          onboardings carry their received documents over as Completed steps. */}
      <OnboardingStepsSection requestId={requestId} onboardingId={onboarding.id} canManage={canManage} />

      <div>
        <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">BGV Status</div>
        <div className="flex flex-wrap items-center gap-2">
          <FormSelect label="" options={BGV_OPTIONS} value={onboarding.bgv_status} onChange={handleBgvChange} small />
          {onboarding.bgv_remark && <span className="text-[0.78rem] text-[#64748b]">{onboarding.bgv_remark}</span>}
        </div>
        {canManage && (
          <Textarea
            rows={1}
            placeholder="BGV remark…"
            value={bgvRemark}
            onChange={(e) => setBgvRemark(e.target.value)}
            className="mt-2 w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.8rem] shadow-none"
          />
        )}
      </div>

      <div>
        <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Joining</div>
        {onboarding.joined_at ? (
          <div className="text-[0.83rem] text-[#0f172a]">
            Joined on <strong>{formatDate(onboarding.joined_at)}</strong>
            {onboarding.closure_due_at && (
              <span className="ml-2 text-[0.75rem] text-[#94a3b8]">
                (closure due {formatDate(onboarding.closure_due_at)})
              </span>
            )}
          </div>
        ) : canManage ? (
          <div className="flex items-center gap-2">
            <Input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} className="h-auto w-40 rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.83rem] shadow-none" />
            <Button size="sm" onClick={handleMarkJoined} disabled={updateMutation.isPending}>Mark Joined</Button>
          </div>
        ) : (
          <span className="text-[0.8rem] text-[#94a3b8]">Not yet joined.</span>
        )}
        {warning && <div className="mt-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.76rem] text-[#92400e]">{warning}</div>}
      </div>

      {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.76rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
