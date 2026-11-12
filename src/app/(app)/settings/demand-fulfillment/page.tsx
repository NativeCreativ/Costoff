'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { SuperAdminSettingsView } from '@/components/demandFulfillment/SuperAdminSettingsView';

/** /settings/demand-fulfillment — super_admin only. */
export default function DemandFulfillmentSettingsPage() {
  return (
    <RequireRole role="super_admin">
      <SuperAdminSettingsView />
    </RequireRole>
  );
}
