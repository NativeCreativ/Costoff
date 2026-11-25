'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { SmartReportView } from '@/components/reports/SmartReportView';

/** Smart Reports — ask questions about your recruitment data in plain English (AI). */
export default function SmartReportPage() {
  return (
    <MasterDataPage wide title="Smart Reports" description="Ask a question in plain English and get an answer from the demands, pipeline, interviews and team data you can see.">
      <SmartReportView />
    </MasterDataPage>
  );
}
