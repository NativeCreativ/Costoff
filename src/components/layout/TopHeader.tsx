"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Profile } from "@/components/types";
import { navIdFromPathname, navItemById } from "@/lib/navigation/routes";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MyProfileDrawer } from "./MyProfileDrawer";
import { USER_ROLE_ABBR } from '@/constants/options';

interface TopHeaderProps {
  currentUser?: Profile | null;
  currentUserLoading?: boolean;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function TopHeader({ currentUser, currentUserLoading }: TopHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  // The subtitle is the current page's nav label, derived from the route.
  const sectionLabel = navItemById(navIdFromPathname(usePathname()))?.label;
  return (
    <>
    <header className="sticky top-0 z-[5] flex h-[68px] items-center justify-between border-b border-[color:var(--card-border)] bg-white/90 px-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] backdrop-blur-md">
      <div>
        <h1 className="text-[1.2rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          Costaff North ATS{" "}
          {sectionLabel ? (
            <span className="text-[0.9rem] font-normal text-[color:var(--text-muted)]">
              - {sectionLabel}
            </span>
          ) : null}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* <Button
          asChild
          className="h-auto gap-1.5 rounded-md bg-[#16a34a] px-3.5 py-2 text-[0.83rem] font-semibold hover:bg-[#16a34a]/90"
        >
          <a href="/api/export" target="_blank" rel="noopener noreferrer">
            <i className="fa-solid fa-file-excel"></i> Export Excel Tracker
          </a>
        </Button> */}

        {/* <div className="search-box">
          <i className="fa-solid fa-magnifying-glass search-icon"></i>
          <Input
            type="text"
            placeholder="Search candidates, demands, clients..."
            className="h-auto w-full rounded-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div> */}

        {/* Notification bell — renders itself only for roles that receive Demand-assignment
            notifications (SPOC / Recruiter); see canViewNotifications. */}
        <NotificationBell currentUser={currentUser} />

        {currentUserLoading ? (
          <div className="flex items-center gap-2 p-1">
            <div className="h-8 w-8 animate-pulse rounded-full bg-[#e2e8f0]" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-[#e2e8f0]" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex cursor-pointer items-center gap-2 rounded-md border-none bg-transparent p-1 hover:bg-[#f1f5f9]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-[0.85rem] font-bold text-white">
              {currentUser ? initials(currentUser.full_name) : "?"}
            </div>
            <span className="text-[0.85rem] font-semibold text-[#0f172a]">
              {currentUser ? (
                <>
                  {currentUser.full_name}{' '}
                  {currentUser.role && (
                    <span className="text-[0.75rem] text-black ms-1 font-bold">
                      ({USER_ROLE_ABBR[currentUser.role] ?? currentUser.role})
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </span>
          </button>
        )}
      </div>
    </header>

    <MyProfileDrawer
      open={profileOpen}
      onClose={() => setProfileOpen(false)}
      currentUser={currentUser ?? null}
      isLoading={currentUserLoading}
    />
    </>
  );
}
