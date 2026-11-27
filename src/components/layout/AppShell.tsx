"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useCurrentUserQuery } from "@/queries/auth/useCurrentUserQuery";
import { canUseModule, moduleForPagePath } from "@/lib/auth/moduleAccess";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

/**
 * Shared app chrome (fixed Sidebar + sticky TopHeader + padded content column).
 *
 * Rendered once by the (app) route-group layout, so every main page gets identical
 * navigation without repeating this markup. Active nav state is derived from the
 * current pathname inside Sidebar/TopHeader, not passed down as props. Collapsed
 * state lives here (not inside Sidebar) since AppShell's content offset (pl-*)
 * must stay in sync with the Sidebar's rendered width.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  // Screen switched off for this employee by the Delivery Head (UX guard; the APIs refuse too).
  const pageModule = moduleForPagePath(pathname);
  const pageBlocked = !!currentUser && !!pageModule && !canUseModule(currentUser.role, currentUser.blocked_modules, pageModule.key);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable (e.g. private mode) — keep default expanded state.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // ignore persistence failures
      }
      return next;
    });
  };

  return (
    <div className={`flex min-h-screen transition-[padding] duration-200 ${collapsed ? "pl-[76px]" : "pl-[270px]"}`}>
      <Sidebar currentUserRole={currentUser?.role} blockedModules={currentUser?.blocked_modules} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-[color:var(--bg-main)]">
        <TopHeader currentUser={currentUser} currentUserLoading={currentUserQuery.isLoading} />

        <div className="flex min-w-0 max-w-full flex-col gap-[22px] px-5 py-6 xl:px-7 [&>*]:min-w-0 [&>*]:max-w-full">
          {pageBlocked ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--card-border)] bg-white px-6 py-16 text-center shadow-[var(--card-shadow)]">
              <ShieldAlert className="h-9 w-9 text-[#dc2626]" />
              <div className="text-[1rem] font-bold text-[#0f172a]">Access turned off</div>
              <div className="max-w-md text-[0.85rem] text-[#64748b]">
                Your access to <strong>{pageModule?.label}</strong> has been turned off. Pick another section from the menu, or ask your Delivery Head.
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
