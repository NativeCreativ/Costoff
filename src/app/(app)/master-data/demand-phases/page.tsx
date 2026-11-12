'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { NamedMasterSection } from '@/components/masterData/NamedMasterSection';

export default function DemandPhasesPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Demand Phase"
        description="Editable list of demand phases. Seeded with Assign, Sourcing, Shortlist, Selection, Onboarding and Closure. Those seven keep their screens. A phase added here appears as its own tab on the demand."
      >
        <NamedMasterSection kind="demand-phases" noun="demand phase" />
      </MasterDataPage>
    </RequireRole>
  );
}
