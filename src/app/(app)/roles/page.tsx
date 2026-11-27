'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { RolesView } from '@/components/users/RolesView';
import { EmployeeAccessPanel } from '@/components/users/EmployeeAccessPanel';

/** /roles — super_admin only (same gate as the previous `activeTab === 'roles' && isSuperAdmin`). */
export default function RolesPage() {
  return (
    <RequireRole role="super_admin">
      <div className="flex flex-col gap-[22px]">
        <EmployeeAccessPanel />
        <RolesView />
      </div>
    </RequireRole>
  );
}
