"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { useCurrentUserQuery } from "@/queries/auth/useCurrentUserQuery";

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
      <Sidebar currentUserRole={currentUser?.role} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-[color:var(--bg-main)]">
        <TopHeader currentUser={currentUser} currentUserLoading={currentUserQuery.isLoading} />

        <div className="flex min-w-0 max-w-full flex-col gap-[22px] px-5 py-6 xl:px-7 [&>*]:min-w-0 [&>*]:max-w-full">{children}</div>
      </main>
    </div>
  );
}
