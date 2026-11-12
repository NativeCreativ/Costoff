'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { EndClientsView } from '@/components/masterData/EndClientsView';

export default function EndClientsPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="End Client Management"
        description="The customer's customer. Name, location, description and an optional SPOC list. Active end clients appear on the demand form."
      >
        <EndClientsView />
      </MasterDataPage>
    </RequireRole>
  );
}
