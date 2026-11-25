'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { SkillsLibrarySection } from '@/components/demandFulfillment/SkillsLibrarySection';
import { SkillGroupsSection } from '@/components/masterData/SkillGroupsSection';

export default function SkillGroupsPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Skill Group Management"
        description="Skill Group → Skill Category → Skills. A group (e.g. Engineering) holds skill categories (e.g. Backend developer), and each category holds its skills. Picking a category on a demand adds its skills."
      >
        <div className="flex flex-col gap-6">
          <SkillGroupsSection />
          <SkillsLibrarySection />
        </div>
      </MasterDataPage>
    </RequireRole>
  );
}
