import { redirect } from 'next/navigation';

/**
 * Entry point.
 *
 * The single-page app that used to live here rendered every section from one Redux
 * `activeTab` string. Each section is now a real route under the (app) group, so `/`
 * simply forwards to the default one. The URL is the source of truth for which page
 * is open — there is no in-memory tab state to restore on refresh.
 */
export default function HomePage() {
  redirect('/org-overview');
}
