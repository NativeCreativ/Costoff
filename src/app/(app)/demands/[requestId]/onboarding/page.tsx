import { DemandDetailRoute } from '@/components/demandFulfillment/DemandDetailRoute';

/** /demands/[requestId]/onboarding — candidates currently onboarding for this demand. */
export default async function DemandOnboardingPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <DemandDetailRoute requestId={requestId} activeTab="onboarding" />;
}
