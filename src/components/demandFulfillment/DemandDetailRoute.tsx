'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { DemandDetailView } from '@/components/demandFulfillment/DemandDetailView';
import { DEMANDS_LIST_HREF } from '@/lib/demandFulfillment/routes';

interface DemandDetailRouteProps {
  requestId: string;
  activeTab: string;
}

/**
 * Shared body for every /demands/[requestId]/* route.
 *
 * Each section is its own URL (so it is deep-linkable, refreshable and back/forward
 * navigable), but all of them render this one component — there is no duplicated page
 * logic, and the tab components are reused untouched.
 *
 * The app chrome comes from the (app) route-group layout, so this only renders the
 * demand detail itself.
 */
export function DemandDetailRoute({ requestId, activeTab }: DemandDetailRouteProps) {
  const router = useRouter();
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;

  const handleBack = useCallback(() => {
    router.push(DEMANDS_LIST_HREF);
  }, [router]);

  return (
    <DemandDetailView
      requestId={requestId}
      activeTab={activeTab}
      currentUser={currentUser}
      onBack={handleBack}
    />
  );
}
