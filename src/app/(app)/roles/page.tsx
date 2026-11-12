'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { RolesView } from '@/components/users/RolesView';

/** /roles — super_admin only (same gate as the previous `activeTab === 'roles' && isSuperAdmin`). */
export default function RolesPage() {
  return (
    <RequireRole role="super_admin">
      <RolesView />
    </RequireRole>
  );
}
