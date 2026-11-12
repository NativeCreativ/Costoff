import { notFound, redirect } from 'next/navigation';
import { DemandDetailRoute } from '@/components/demandFulfillment/DemandDetailRoute';
import {
  DEFAULT_DEMAND_DETAIL_TAB,
  DEMAND_DETAIL_TABS,
  demandDetailHref,
  isRetiredDemandDetailTab,
} from '@/lib/demandFulfillment/routes';

/**
 * /demands/[requestId]/[tab] — every demand-detail tab that has no folder of its own (Assign,
 * Sourcing, Shortlist, Selection, Closure, Change Log). demandDetailHref links tabs here by path,
 * and before this file only Onboarding had a page, so the other tabs answered 404. Folders such
 * as onboarding/ still win over this dynamic segment.
 */
export default async function DemandDetailTabPage({ params }: { params: Promise<{ requestId: string; tab: string }> }) {
  const { requestId, tab } = await params;
  if (isRetiredDemandDetailTab(tab) || tab === DEFAULT_DEMAND_DETAIL_TAB) {
    redirect(demandDetailHref(requestId, DEFAULT_DEMAND_DETAIL_TAB));
  }
  if (!DEMAND_DETAIL_TABS.some((t) => t.id === tab)) notFound();
  return <DemandDetailRoute requestId={requestId} activeTab={tab} />;
}
