'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { SkillsLibrarySection } from '@/components/demandFulfillment/SkillsLibrarySection';

export default function SkillGroupsPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Skill Group Management"
        description="A skill group is a template: a name, a description, Active or Inactive, and the skills that belong to it. Picking a group on a demand adds those skills."
      >
        <SkillsLibrarySection />
      </MasterDataPage>
    </RequireRole>
  );
}
