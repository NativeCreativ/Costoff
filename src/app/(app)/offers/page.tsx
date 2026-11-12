'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, LISTS } from '@/features/listState/listStateSlice';
import { useOffersQuery } from '@/queries/offers/useOffersQuery';
import { useOnboardingsQuery } from '@/queries/offers/useOnboardingsQuery';
import { useDeleteOfferMutation } from '@/queries/offers/useOfferMutations';
import { OffersView } from '@/components/offers/OffersView';
import { useLifecycleDrawer } from '@/hooks/useLifecycleDrawer';

/** /offers — Offers & Onboardings. The Offers/Onboarding toggle is a view switch, not a route. */
export default function OffersPage() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.listState[LISTS.offers]);
  const { openLifecycle, overlays } = useLifecycleDrawer();

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.offers, key, value: v }));

  // Local view switch, as before — it toggles between two trackers on one page.
  const [offersSubTab, setOffersSubTab] = useState<'offers' | 'onboardings'>('offers');

  const offersQuery = useOffersQuery(filter('offerStatus'));
  const onboardingsQuery = useOnboardingsQuery(filter('bgv'));
  const deleteOfferMutation = useDeleteOfferMutation();

  const [deletingItem, setDeletingItem] = useState<{
    id: string;
    type: 'demand' | 'candidate' | 'offer';
  } | null>(null);

  return (
    <>
      <OffersView
        offersSubTab={offersSubTab}
        setOffersSubTab={setOffersSubTab}
        offers={offersQuery.data ?? []}
        loadingOffers={offersQuery.isLoading}
        offerStatusFilter={filter('offerStatus')}
        setOfferStatusFilter={setFilterValue('offerStatus')}
        onboardings={onboardingsQuery.data ?? []}
        loadingOnboardings={onboardingsQuery.isLoading}
        bgvFilter={filter('bgv')}
        setBgvFilter={setFilterValue('bgv')}
        deletingItem={deletingItem}
        openLifecycle={openLifecycle}
        onDeleteRequest={(id: string, type: 'demand' | 'candidate' | 'offer') =>
          setDeletingItem({ id, type })
        }
        onDeleteCancel={() => setDeletingItem(null)}
        handleDelete={(id: string, type: 'demand' | 'candidate' | 'offer') => {
          // Only the offer delete mutation exists on this page; the other two types
          // are handled on their own routes.
          if (type === 'offer') {
            deleteOfferMutation.mutate(id, {
              onSuccess: () => setDeletingItem(null),
              onError: (err) => console.error('Error deleting offer:', err),
            });
          }
        }}
      />

      {overlays}
    </>
  );
}
