'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { NamedMasterSection } from '@/components/masterData/NamedMasterSection';

export default function DemandCategoriesPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Demand Category Management"
        description="Source of truth for the demand category dropdown. Seeded with FTE, Contractor, C2H and the employment types already used on demands."
      >
        <NamedMasterSection kind="demand-categories" noun="demand category" />
      </MasterDataPage>
    </RequireRole>
  );
}
