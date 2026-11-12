'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { NamedMasterSection } from '@/components/masterData/NamedMasterSection';

export default function InterviewStatusesPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Interview Status Management"
        description="Statuses used by interview and selection dropdowns, including Client No-Show. Scheduled stays a creation-only status. Completed still requires a result."
      >
        <NamedMasterSection kind="interview-statuses" noun="interview status" />
      </MasterDataPage>
    </RequireRole>
  );
}
