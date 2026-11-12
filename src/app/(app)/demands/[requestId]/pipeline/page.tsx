import { redirect } from 'next/navigation';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';

/** Old pipeline URL. Sourcing is the lifecycle tab that holds uploaded profiles. */
export default async function DemandPipelinePage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  redirect(demandDetailHref(requestId, 'sourcing'));
}
