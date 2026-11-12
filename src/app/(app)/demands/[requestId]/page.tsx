import { redirect } from 'next/navigation';
import { DemandDetailRoute } from '@/components/demandFulfillment/DemandDetailRoute';
import {
  DEFAULT_DEMAND_DETAIL_TAB,
  demandDetailHref,
  isRetiredDemandDetailTab,
  normalizeDemandDetailTab,
} from '@/lib/demandFulfillment/routes';

export default async function DemandDetailIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { requestId } = await params;
  const sp = await searchParams;
  const rawTab = Array.isArray(sp?.tab) ? sp?.tab[0] : sp?.tab;

  if (isRetiredDemandDetailTab(rawTab)) {
    redirect(demandDetailHref(requestId, DEFAULT_DEMAND_DETAIL_TAB));
  }

  return <DemandDetailRoute requestId={requestId} activeTab={normalizeDemandDetailTab(rawTab)} />;
}