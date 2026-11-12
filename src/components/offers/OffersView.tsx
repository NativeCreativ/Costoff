'use client';

import { Offer, Onboarding } from '../types';
import { OffersTable } from './OffersTable';
import { OnboardingsTable } from './OnboardingsTable';
import { OFFER_STATUS_OPTIONS, BGV_STATUS_OPTIONS } from '@/constants/options';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/FilterSelect';

interface OffersViewProps {
  offersSubTab: 'offers' | 'onboardings';
  setOffersSubTab: (v: 'offers' | 'onboardings') => void;
  offers: Offer[];
  loadingOffers: boolean;
  offerStatusFilter: string;
  setOfferStatusFilter: (v: string) => void;
  onboardings: Onboarding[];
  loadingOnboardings: boolean;
  bgvFilter: string;
  setBgvFilter: (v: string) => void;
  deletingItem: { id: string; type: 'demand' | 'candidate' | 'offer' } | null;
  openLifecycle: (reqId: string) => void;
  onDeleteRequest: (id: string, type: 'demand' | 'candidate' | 'offer') => void;
  onDeleteCancel: () => void;
  handleDelete: (id: string, type: 'demand' | 'candidate' | 'offer') => void;
}

export function OffersView({
  offersSubTab, setOffersSubTab, offers, loadingOffers, offerStatusFilter, setOfferStatusFilter,
  onboardings, loadingOnboardings, bgvFilter, setBgvFilter, deletingItem, openLifecycle,
  onDeleteRequest, onDeleteCancel, handleDelete
}: OffersViewProps) {
  return (
    <>
      <div className="mb-4 flex gap-0">
        <Button
          onClick={() => setOffersSubTab('offers')}
          className={`h-auto rounded-l-lg rounded-r-none border border-r-0 border-[#e2e8f0] px-6 py-2.5 text-[0.85rem] font-semibold ${offersSubTab === 'offers' ? 'bg-[#2563eb] text-white hover:bg-[#2563eb]/90' : 'bg-white text-[#64748b] hover:bg-white/80'}`}
        >
          <i className="fa-solid fa-gift mr-1.5"></i>Offers Tracker
        </Button>
        <Button
          onClick={() => setOffersSubTab('onboardings')}
          className={`h-auto rounded-l-none rounded-r-lg border border-[#e2e8f0] px-6 py-2.5 text-[0.85rem] font-semibold ${offersSubTab === 'onboardings' ? 'bg-[#2563eb] text-white hover:bg-[#2563eb]/90' : 'bg-white text-[#64748b] hover:bg-white/80'}`}
        >
          <i className="fa-solid fa-user-check mr-1.5"></i>Onboarding Tracker
        </Button>
      </div>

      {offersSubTab === 'offers' && (
        <>
          <div className="list-toolbar">
            <div className="list-toolbar-row">
              <span className="text-[0.88rem] font-bold text-[#0f172a]">Offers Issued & Acceptance Tracking</span>
              <FilterSelect value={offerStatusFilter} onChange={setOfferStatusFilter} options={OFFER_STATUS_OPTIONS} allLabel="All Offer Statuses" />
            </div>
          </div>
          <OffersTable
            offers={offers}
            loadingOffers={loadingOffers}
            deletingItem={deletingItem}
            openLifecycle={openLifecycle}
            onDeleteRequest={onDeleteRequest}
            onDeleteCancel={onDeleteCancel}
            handleDelete={handleDelete}
          />
        </>
      )}

      {offersSubTab === 'onboardings' && (
        <>
          <div className="list-toolbar">
            <div className="list-toolbar-row">
              <span className="text-[0.88rem] font-bold text-[#0f172a]">Onboarding & BGV Verification Tracker</span>
              <FilterSelect value={bgvFilter} onChange={setBgvFilter} options={BGV_STATUS_OPTIONS} allLabel="All BGV Statuses" />
            </div>
          </div>
          <OnboardingsTable
            onboardings={onboardings}
            loadingOnboardings={loadingOnboardings}
            openLifecycle={openLifecycle}
          />
        </>
      )}
    </>
  );
}
