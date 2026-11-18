'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { ContributionReportView } from '@/components/reports/ContributionReportView';

/** Team Contribution — each person's work across demands and phases for a date range. */
export default function ContributionReportPage() {
  return (
    <MasterDataPage wide title="Team Contribution" description="What each person did on demands in a date range, from calls to joinings. Click a person to see it per demand.">
      <ContributionReportView />
    </MasterDataPage>
  );
}
