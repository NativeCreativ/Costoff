'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { ReadyToJoinReportView } from '@/components/reports/ReadyToJoinReportView';

/** Advanced Report 1 — ready-to-join candidates by skill group, drilling down by location. */
export default function ReadyToJoinReportPage() {
  return (
    <MasterDataPage wide title="Ready to Join" description="Candidates in our database who can join now, by skill group. Click a group to see it location-wise with the candidate list.">
      <ReadyToJoinReportView />
    </MasterDataPage>
  );
}
