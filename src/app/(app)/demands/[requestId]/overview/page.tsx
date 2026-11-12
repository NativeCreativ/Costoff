import { redirect } from 'next/navigation';
import { DEFAULT_DEMAND_DETAIL_TAB, demandDetailHref } from '@/lib/demandFulfillment/routes';

/**
 * /demands/[requestId]/overview — the retired Overview section.
 *
 * The demand summary now lives in a single card above the tab bar on every tab, so
 * there is no Overview route any more. This redirect exists purely so links already
 * saved in bookmarks, notifications or chat history keep working: they land on the
 * default tab (Pipeline) with the same overview card visible above it.
 */
export default async function RetiredDemandOverviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  redirect(demandDetailHref(requestId, DEFAULT_DEMAND_DETAIL_TAB));
}