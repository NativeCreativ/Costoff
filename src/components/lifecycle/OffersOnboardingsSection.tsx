'use client';

import { formatScheduledDate } from '@/lib/utils';

interface OffersOnboardingsSectionProps {
  offers: any[];
  onboardings: any[];
}

export function OffersOnboardingsSection({ offers, onboardings }: OffersOnboardingsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
        <h4 className="mb-2.5 text-[0.9rem] font-bold text-[#059669]">
          3. Offers ({offers?.length || 0})
        </h4>
        {!offers || offers.length === 0 ? (
          <p className="text-[0.82rem] italic text-[#94a3b8]">No offers issued yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {offers.map((off: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-2.5 text-[0.8rem]">
                <div className="font-bold text-[#166534]">{off.candidates?.full_name || 'Candidate'}</div>
                <div className="mt-0.5 text-[0.75rem] text-[#15803d]">₹{off.offered_ctc} LPA | Offer Date: {off.offer_date ? formatScheduledDate(off.offer_date) : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
        <h4 className="mb-2.5 text-[0.9rem] font-bold text-[#0284c7]">
          4. Onboarding ({onboardings?.length || 0})
        </h4>
        {!onboardings || onboardings.length === 0 ? (
          <p className="text-[0.82rem] italic text-[#94a3b8]">No onboarding records yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {onboardings.map((ob: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-2.5 text-[0.8rem]">
                <div className="font-bold text-[#0369a1]">{ob.candidates?.full_name || 'Candidate'}</div>
                <div className="mt-0.5 text-[0.75rem] text-[#0284c7]">Joining: {ob.actual_joining_date ? formatScheduledDate(ob.actual_joining_date) : 'TBD'} | BGV: {ob.bgv_status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
