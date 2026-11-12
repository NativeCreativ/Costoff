'use client';

import { ShieldAlert } from 'lucide-react';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';

interface RequireRoleProps {
  /** role the current user must hold */
  role: string;
  children: React.ReactNode;
}

/**
 * Route-level access gate for the super_admin sections (User Management,
 * Roles & Permissions, Demand Fulfillment Settings).
 *
 * Previously these were `activeTab === 'users' && isSuperAdmin && <UsersView/>` inside
 * the single-page app, so a non-super_admin hitting the tab got a blank content area.
 * Hiding the sidebar link was the only real control. This keeps the same rule but
 * makes the refusal explicit, and — importantly — the API routes still enforce their
 * own permission checks, so this is a UX guard, not the security boundary.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const currentUserQuery = useCurrentUserQuery();

  if (currentUserQuery.isLoading) return null;

  if (currentUserQuery.data?.role !== role) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--card-border)] bg-white px-6 py-16 text-center shadow-[var(--card-shadow)]">
        <ShieldAlert className="h-9 w-9 text-[#dc2626]" />
        <div className="text-[1rem] font-bold text-[#0f172a]">Access restricted</div>
        <div className="max-w-md text-[0.85rem] text-[#64748b]">
          This section is only available to <strong>{role.replace(/_/g, ' ')}</strong> accounts.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
