import { redirect } from 'next/navigation';
import { DEFAULT_DEMAND_DETAIL_TAB, demandDetailHref } from '@/lib/demandFulfillment/routes';

export default async function RetiredDemandSettingsPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  redirect(demandDetailHref(requestId, DEFAULT_DEMAND_DETAIL_TAB));
}
