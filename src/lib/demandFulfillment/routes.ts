/**
 * Route definitions for the demand-detail drill-down.
 *
 * Single source of truth shared by the route files and by
 * DemandDetailView's tab bar, so the URL for a section is never written twice.
 *
 * There is no "Overview" tab: the demand summary is a single card rendered at page
 * level above the tab bar on EVERY tab (see DemandOverviewCard), so it is not a
 * section and has no route of its own.
 */

export const DEMAND_DETAIL_TABS = [
  { id: 'details', label: 'Details', phase: 'Details' },
  { id: 'assign', label: 'Assign', phase: 'Assign' },
  // Not a lifecycle phase: customer instructions for the recruiters (Instruction Log).
  { id: 'instructions', label: 'Instructions', phase: 'Instructions' },
  { id: 'sourcing', label: 'Sourcing', phase: 'Sourcing' },
  { id: 'shortlist', label: 'Shortlist', phase: 'Shortlist' },
  { id: 'selection', label: 'Selection', phase: 'Selection' },
  { id: 'onboarding', label: 'Onboarding', phase: 'Onboarding' },
  { id: 'closure', label: 'Closure', phase: 'Closure' },
  // Not a lifecycle phase: the demand's history (fields, candidates, assignments, status).
  { id: 'change-log', label: 'Change Log', phase: 'Change Log' },
] as const;

export type DemandDetailTab = (typeof DEMAND_DETAIL_TABS)[number]['id'];

/** Extra Demand Phase master rows use this id shape so they can have their own tab URL. */
export function customPhaseTabId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `phase-${slug || 'extra'}`;
}

export function isCustomPhaseTab(value: string): boolean {
  return /^phase-[a-z0-9-]{1,60}$/.test(value);
}

export const DEFAULT_DEMAND_DETAIL_TAB: DemandDetailTab = 'details';

const TAB_IDS = DEMAND_DETAIL_TABS.map((t) => t.id) as readonly string[];

/** Section ids that used to exist and whose URLs are still in bookmarks, notifications
 *  and browser history. They are NOT valid tabs any more — callers use this to send an
 *  old link to the default tab instead of rendering an empty section. Interview round
 *  configuration moved into the Edit Demand form, so "settings" retired along with it. */
const RETIRED_TAB_IDS: readonly string[] = ['overview', 'settings', 'pipeline', 'interviews'];

/** True for a retired section id (currently just "overview"). */
export function isRetiredDemandDetailTab(value: unknown): boolean {
  return typeof value === 'string' && RETIRED_TAB_IDS.includes(value);
}

/**
 * Narrow an arbitrary URL segment (or ?tab= value) to a known section, falling back to
 * the default. Anything unknown — including a retired id — resolves to Pipeline rather
 * than throwing or rendering nothing.
 */
export function normalizeDemandDetailTab(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_DEMAND_DETAIL_TAB;
  if (TAB_IDS.includes(value)) return value;
  if (isCustomPhaseTab(value)) return value;
  return DEFAULT_DEMAND_DETAIL_TAB;
}

export function isDemandDetailTab(value: unknown): value is DemandDetailTab {
  return typeof value === 'string' && TAB_IDS.includes(value);
}

/** requestId is user data (e.g. "REQ/2026-1") — always encode it into the path. */
export function demandDetailHref(requestId: string, tab: string = DEFAULT_DEMAND_DETAIL_TAB): string {
  const base = `/demands/${encodeURIComponent(requestId)}`;
  if (tab === DEFAULT_DEMAND_DETAIL_TAB) return base;
  if ((TAB_IDS as readonly string[]).includes(tab)) return `${base}/${tab}`;
  return `${base}?tab=${encodeURIComponent(tab)}`;
}

/** Where the Back button and the sidebar "Demands" entry return to. */
export const DEMANDS_LIST_HREF = '/demands';