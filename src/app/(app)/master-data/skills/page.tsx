'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { SkillsManagementSection } from '@/components/masterData/SkillsManagementSection';

export default function SkillsMasterPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Skills Management"
        description="Each skill has a name, a Mandatory or Optional type, and a skill category such as Technical, Behavioural or Domain."
      >
        <SkillsManagementSection />
      </MasterDataPage>
    </RequireRole>
  );
}
