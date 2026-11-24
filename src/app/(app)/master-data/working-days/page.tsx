'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { WorkingDaysSection } from '@/components/masterData/WorkingDaysSection';

export default function WorkingDaysPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Working Days Management"
        description="Configure monthly working days and holidays for average data metrics and leave calculations."
      >
        <WorkingDaysSection />
      </MasterDataPage>
    </RequireRole>
  );
}
