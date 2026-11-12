/**
 * Main-navigation route map.
 *
 * Single source of truth for the sidebar, the header title and the "which nav item
 * is active" check. Active state is derived from the current pathname — there is no
 * separate `activeTab` React state for navigation purposes.
 *
 * Only sections reachable from the sidebar are listed. The dormant views that used
 * to be commented out in Sidebar.tsx are intentionally not routable.
 */

export interface NavItem {
  /** Stable id, kept equal to the old Redux activeTab value for continuity. */
  id: string;
  href: string;
  label: string;
  icon: string;
  /** When set, the nav item is only rendered for this role. */
  requiredRole?: string;
}

export interface NavSection {
  title: string;
  /**
   * When set, the whole section is only rendered for these roles. This is the coarse
   * section-level gate; each item can still carry its own `requiredRole`.
   */
  requiredRoles?: string[];
  /** @deprecated Single-role form of `requiredRoles`, kept for backwards compatibility. */
  requiredRole?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: '1. DASHBOARD',
    items: [
      { id: 'org_overview', href: '/org-overview', label: 'Org Overview', icon: 'fa-building-user' },
    ],
  },
  {
    title: '2. RECRUITMENT OPERATIONS',
    items: [
      { id: 'demands', href: '/demands', label: 'Demands / Requirements', icon: 'fa-file-contract' },
      { id: 'candidates', href: '/candidates', label: 'Candidate Pipeline', icon: 'fa-user-group' },
      { id: 'interviews', href: '/interviews', label: 'Interviews & Schedules', icon: 'fa-calendar-check' },
      { id: 'interview_calendar', href: '/interview-calendar', label: 'Interview Calendar', icon: 'fa-calendar-days' },
      // { id: 'offers', href: '/offers', label: 'Offers & Onboardings', icon: 'fa-award' },
    ],
  },
  // {
  //   title: '3. PERFORMANCE & ANALYTICS',
  //   items: [
  //     { id: 'performance_ta', href: '/performance/recruiters', label: 'Recruiter Performance', icon: 'fa-chart-line' },
  //     { id: 'performance_am', href: '/performance/account-managers', label: 'AM Performance', icon: 'fa-briefcase' },
  //     { id: 'client_analytics', href: '/performance/client-analytics', label: 'Client & Source Analytics', icon: 'fa-building' },
  //     { id: 'global_kpis', href: '/performance/global-kpis', label: 'Global KPIs', icon: 'fa-bullseye' },
  //   ],
  // },
  {
    // Everyone: own Task Log; the To-Do List is read by all and written by AM / SPOC / DH.
    title: '3. TEAM WORK',
    items: [
      { id: 'todo', href: '/todo', label: 'To-Do List', icon: 'fa-list-ul' },
      { id: 'task_log', href: '/task-log', label: 'Task Log', icon: 'fa-clipboard-list' },
    ],
  },
  {
    // All roles; each report is scoped server-side to what the viewer may see.
    title: '4. REPORTS',
    items: [
      { id: 'report_client_phases', href: '/reports/client-phases', label: 'Client-wise Demands', icon: 'fa-chart-column' },
      { id: 'report_interviews_today', href: '/reports/interviews-today', label: "Today's Interviews", icon: 'fa-user-clock' },
      { id: 'report_ready_to_join', href: '/reports/ready-to-join', label: 'Ready to Join', icon: 'fa-user-check' },
    ],
  },
  {
    title: '5. MASTER DATA MANAGEMENT',
    requiredRoles: ['super_admin'],
    items: [
      { id: 'companies', href: '/companies', label: 'Client Management', icon: 'fa-building' },
      { id: 'end_clients', href: '/master-data/end-clients', label: 'End Client Management', icon: 'fa-city' },
      { id: 'skill_groups', href: '/master-data/skill-groups', label: 'Skill Group Management', icon: 'fa-layer-group' },
      { id: 'skills', href: '/master-data/skills', label: 'Skills Management', icon: 'fa-tags' },
      { id: 'demand_categories', href: '/master-data/demand-categories', label: 'Demand Category Management', icon: 'fa-list' },
      { id: 'demand_phases', href: '/master-data/demand-phases', label: 'Demand Phase', icon: 'fa-bars-staggered' },
      { id: 'locations', href: '/master-data/locations', label: 'Locations', icon: 'fa-location-dot' },
      { id: 'demand_types', href: '/master-data/demand-types', label: 'Demand Type', icon: 'fa-shapes' },
      { id: 'interview_statuses', href: '/master-data/interview-statuses', label: 'Interview Status Management', icon: 'fa-clipboard-check' },
      { id: 'onboarding_documents', href: '/master-data/onboarding-documents', label: 'Onboarding Steps', icon: 'fa-list-check' },
    ],
  },
  {
    title: '6. USERS & ACCESS CONTROL',
    requiredRoles: ['super_admin'],
    items: [
      { id: 'users', href: '/users', label: 'User Management', icon: 'fa-users-gear', requiredRole: 'super_admin' },
      { id: 'roles', href: '/roles', label: 'Roles & Permissions', icon: 'fa-shield-halved', requiredRole: 'super_admin' },
      { id: 'settings_demand_fulfillment', href: '/settings/demand-fulfillment', label: 'Demand Fulfillment Settings', icon: 'fa-sliders', requiredRole: 'super_admin' },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const DEFAULT_NAV_ID = 'org_overview';

/**
 * Resolve the active nav id from a pathname. Prefix matching keeps a nav item
 * active while the user is deeper inside it — e.g. /demands/REQ-1/pipeline
 * keeps "Demands / Requirements" highlighted.
 */
export function navIdFromPathname(pathname: string): string {
  const path = pathname || '/';
  // Longest href first so /interview-calendar wins over a hypothetical /interviews prefix
  // and /demands/... wins over /.
  const match = [...ALL_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => path === item.href || path.startsWith(`${item.href}/`));
  return match ? match.id : DEFAULT_NAV_ID;
}

export function navItemById(id: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}

/** Route-level role gate, mirroring the old `&& isSuperAdmin` render conditions. */
export function canAccessNavItem(item: NavItem, role?: string | null): boolean {
  return !item.requiredRole || item.requiredRole === role;
}

/**
 * Section-level role gate. A section renders when ANY of its `requiredRoles` matches;
 * sections with no gate always render. Item-level gates are applied separately by
 * canAccessNavItem, which is why section 4 can be visible to an AM (for Company Master)
 * while its Super Admin-only items stay hidden.
 */
export function canAccessNavSection(section: NavSection, role?: string | null): boolean {
  const allowed = section.requiredRoles ?? (section.requiredRole ? [section.requiredRole] : undefined);
  if (!allowed || allowed.length === 0) return true;
  return !!role && allowed.includes(role);
}
