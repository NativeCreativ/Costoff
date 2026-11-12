"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, canAccessNavItem, canAccessNavSection, navIdFromPathname } from "@/lib/navigation/routes";

interface SidebarProps {
  currentUserRole?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * Main navigation. Each item is a real <Link> to a route, and the active item is
 * derived from the current pathname — there is no `activeTab` state here.
 */
export function Sidebar({ currentUserRole, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const activeNavId = navIdFromPathname(pathname);

  // Section gate first, then per-item gates. Both are needed: section 4 is visible to
  // super_admin + account_manager (for Company Master) while its individual items stay
  // Super Admin only.
  const visibleSections = NAV_SECTIONS.filter((section) => canAccessNavSection(section, currentUserRole))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessNavItem(item, currentUserRole)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={`fixed left-0 top-0 z-10 flex h-screen flex-col overflow-hidden border-r border-[color:var(--sidebar-border)] shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-[width] duration-200 ${
        collapsed ? "w-[76px]" : "w-[270px]"
      }`}
      style={{ background: "var(--sidebar-bg-gradient)" }}
    >
      <div
        className={`flex shrink-0 items-center border-b border-[color:var(--sidebar-border)] py-[22px] ${
          collapsed ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {!collapsed && (
          <span className="font-['Cinzel',serif] text-[1.35rem] font-extrabold tracking-[2px] text-white [text-shadow:0_2px_10px_rgba(255,255,255,0.1)]">
            COSTAFF
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="cursor-pointer border-none bg-none text-[1.1rem] text-[#94a3b8] transition-colors duration-200 hover:text-white"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <i className="fa-solid fa-bars"></i>
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-[18px] [scrollbar-color:rgba(255,255,255,0.1)_transparent] [scrollbar-width:thin]">
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed && (
              <div className="px-[22px] py-2 text-[0.7rem] font-extrabold uppercase tracking-[1.2px] text-[color:var(--sidebar-title)]">
                {section.title}
              </div>
            )}
            <ul className="list-none">
              {section.items.map((item) => {
                const isActive = activeNavId === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`flex w-full cursor-pointer items-center border-l-[3px] bg-none text-left text-[0.85rem] no-underline transition-all duration-200 hover:text-[color:var(--sidebar-text-active)] hover:bg-[color:var(--sidebar-hover-bg)] ${
                        collapsed ? "justify-center px-0 py-2.5" : "px-[22px] py-2.5 hover:pl-[25px]"
                      } ${
                        isActive
                          ? "border-l-[#3b82f6] bg-[rgba(37,99,235,0.18)] font-semibold text-[color:var(--sidebar-text-active)]"
                          : "border-l-transparent font-medium text-[color:var(--sidebar-text)]"
                      }`}
                    >
                      <i
                        className={`fa-solid ${item.icon} text-center text-[0.9rem] ${collapsed ? "w-[18px]" : "mr-3 w-[18px]"}`}
                      ></i>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
