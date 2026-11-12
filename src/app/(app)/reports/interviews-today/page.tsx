'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { TodaysInterviewsReportView } from '@/components/reports/TodaysInterviewsReportView';

/** Report 2 — today's interviews with their current status (view only). */
export default function InterviewsTodayReportPage() {
  return (
    <MasterDataPage wide title="Today's Interviews" description="Every interview scheduled for the day and its current status. Click a status to drill in; pick another date to look back or ahead.">
      <TodaysInterviewsReportView />
    </MasterDataPage>
  );
}
