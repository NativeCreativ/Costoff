'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { NamedMasterSection } from '@/components/masterData/NamedMasterSection';

export default function LocationsPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Locations"
        description="Work locations offered as a typeahead on the demand form. Seeded with Bangalore, Chennai and Hyderabad."
      >
        <NamedMasterSection kind="locations" noun="location" />
      </MasterDataPage>
    </RequireRole>
  );
}
