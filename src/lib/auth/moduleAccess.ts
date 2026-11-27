/**
 * Per-employee screen access (Roles & Permissions → Employee access).
 *
 * The Delivery Head (super_admin) can switch individual screens off for any other employee.
 * The switched-off list is stored on `profiles.blocked_modules`. A super_admin always has every
 * screen and cannot be restricted. Screens that are already super_admin-only (master data, users,
 * settings) stay that way and are not listed here.
 *
 * Edge-safe (no Prisma import): used by the Sidebar, the AppShell page guard, and `requireAuth`.
 */

export interface AccessModule {
  key: string;
  label: string;
  group: string;
  /** Page path prefixes (UI guard). */
  pages: string[];
  /**
   * API path prefixes refused server-side when the screen is off. Only APIs that belong to this
   * screen alone are listed: shared APIs (demands, candidates, interviews) also feed other screens'
   * pickers and pipelines, so for those screens the page itself is what is closed.
   */
  apis: string[];
}

export const ACCESS_MODULES: AccessModule[] = [
  { key: 'org_overview', label: 'Org Overview', group: 'Dashboard', pages: ['/org-overview'], apis: ['/api/dashboard'] },
  { key: 'demands', label: 'Demands / Requirements', group: 'Recruitment operations', pages: ['/demands'], apis: [] },
  { key: 'candidates', label: 'Candidate Pipeline', group: 'Recruitment operations', pages: ['/candidates'], apis: [] },
  { key: 'interviews', label: 'Interviews & Schedules', group: 'Recruitment operations', pages: ['/interviews'], apis: [] },
  { key: 'interview_calendar', label: 'Interview Calendar', group: 'Recruitment operations', pages: ['/interview-calendar'], apis: ['/api/calendar'] },
  { key: 'todo', label: 'To-Do List', group: 'Team work', pages: ['/todo'], apis: ['/api/todos'] },
  { key: 'task_log', label: 'Task Log', group: 'Team work', pages: ['/task-log'], apis: ['/api/task-logs'] },
  { key: 'report_client_phases', label: 'Client-wise Demands', group: 'Reports', pages: ['/reports/client-phases'], apis: ['/api/reports/client-phases'] },
  { key: 'report_interviews_today', label: "Today's Interviews", group: 'Reports', pages: ['/reports/interviews-today'], apis: ['/api/reports/todays-interviews'] },
  { key: 'report_ready_to_join', label: 'Ready to Join', group: 'Reports', pages: ['/reports/ready-to-join'], apis: ['/api/reports/ready-to-join'] },
  { key: 'report_candidate_aging', label: 'Candidate Aging', group: 'Reports', pages: ['/reports/candidate-aging'], apis: ['/api/reports/candidate-aging'] },
  { key: 'report_contribution', label: 'Team Contribution', group: 'Reports', pages: ['/reports/contribution'], apis: ['/api/reports/contribution'] },
  { key: 'report_smart', label: 'Smart Reports (AI)', group: 'Reports', pages: ['/reports/smart'], apis: ['/api/reports/smart'] },
];

export const ACCESS_MODULE_KEYS = ACCESS_MODULES.map((m) => m.key);

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function moduleForPagePath(path: string): AccessModule | undefined {
  return ACCESS_MODULES.find((m) => m.pages.some((p) => matchesPrefix(path, p)));
}

export function moduleForApiPath(path: string): AccessModule | undefined {
  return ACCESS_MODULES.find((m) => m.apis.some((p) => matchesPrefix(path, p)));
}

/** Keeps only known keys, without duplicates, in the module order. */
export function sanitizeBlockedModules(keys: readonly string[] | null | undefined): string[] {
  const wanted = new Set(keys ?? []);
  return ACCESS_MODULE_KEYS.filter((k) => wanted.has(k));
}

/** Whether this employee may use the screen. super_admin always may. */
export function canUseModule(role: string | null | undefined, blocked: readonly string[] | null | undefined, key: string): boolean {
  if (role === 'super_admin') return true;
  return !(blocked ?? []).includes(key);
}
