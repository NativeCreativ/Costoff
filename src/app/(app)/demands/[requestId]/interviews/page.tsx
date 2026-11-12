import { redirect } from 'next/navigation';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';

/** Old calendar URL. Selection is the lifecycle tab for interviews on this demand. */
export default async function DemandInterviewsPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  redirect(demandDetailHref(requestId, 'selection'));
}
