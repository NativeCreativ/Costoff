'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { NamedMasterSection } from '@/components/masterData/NamedMasterSection';
import { DemandTypeSkillGroupsSection } from '@/components/masterData/DemandTypeSkillGroupsSection';

export default function DemandTypesPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Demand Type"
        description="Technical, Non-Technical, Domain and General. This is the demand-type field on create and edit. It is not the later Proactive/Active flag."
      >
        <NamedMasterSection kind="demand-types" noun="demand type" />
        <DemandTypeSkillGroupsSection />
      </MasterDataPage>
    </RequireRole>
  );
}
