'use client';

import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { ClientPhasesReportView } from '@/components/reports/ClientPhasesReportView';

/** Report 1 — client-wise demand progress by phase, with drill-down to demands. */
export default function ClientPhasesReportPage() {
  return (
    <MasterDataPage wide title="Client-wise Demand Report" description="How many candidates each client's demands have in every phase (count and %). Click a client to drill into its demands.">
      <ClientPhasesReportView />
    </MasterDataPage>
  );
}
