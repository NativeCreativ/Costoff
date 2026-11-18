'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { CandidateAgingReportView } from '@/components/reports/CandidateAgingReportView';

/** Candidate Aging — days each candidate has spent in each demand phase. */
export default function CandidateAgingReportPage() {
  return (
    <MasterDataPage wide title="Candidate Aging" description="How long each candidate has been in their current phase, and in each phase before it. Longest wait first.">
      <CandidateAgingReportView />
    </MasterDataPage>
  );
}
