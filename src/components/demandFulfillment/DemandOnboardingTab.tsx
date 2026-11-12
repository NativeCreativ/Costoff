'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { useDemandCandidatesQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { CandidateDetailPanel } from './CandidateDetailPanel';
import { submissionStatusLabel, SUBMISSION_STATUS_COLORS } from './statusStyles';
import { formatDate } from '@/lib/utils';

const ONBOARDING_STATUSES = ['onboarding', 'bgv_pending', 'bgv_verified', 'joined'];

interface DemandOnboardingTabProps {
  requestId: string;
  canManage: boolean;
}

export function DemandOnboardingTab({ requestId, canManage }: DemandOnboardingTabProps) {
  const [selectedDcId, setSelectedDcId] = useState<string | null>(null);
  const candidatesQuery = useDemandCandidatesQuery(requestId);
  const candidates = (candidatesQuery.data?.candidates ?? []).filter((c) => ONBOARDING_STATUSES.includes(c.current_status));

  return (
    <div className="rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      {candidatesQuery.isLoading ? (
        <Loader message="Loading onboarding candidates…" />
      ) : candidates.length === 0 ? (
        <div className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No candidates are in onboarding yet.</div>
      ) : (
        <table className="w-full text-left text-[0.83rem]">
          <thead>
            <tr className="border-b border-[#e2e8f0] text-[0.75rem] uppercase tracking-wide text-[#94a3b8]">
              <th className="px-4 py-3 font-semibold">Candidate</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Added</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const color = SUBMISSION_STATUS_COLORS[c.current_status];
              return (
                <tr key={c.id} onClick={() => setSelectedDcId(c.id)} className="cursor-pointer border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-semibold text-[#0f172a]">{c.candidates?.full_name || 'Candidate'}</td>
                  <td className="px-4 py-3">
                    <Badge className="border-transparent text-[0.72rem] font-semibold hover:bg-inherit" style={{ backgroundColor: color?.bg, color: color?.text }}>
                      {submissionStatusLabel(c.current_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(c.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selectedDcId && (
        <CandidateDetailPanel requestId={requestId} dcId={selectedDcId} canManage={canManage} onClose={() => setSelectedDcId(null)} />
      )}
    </div>
  );
}
