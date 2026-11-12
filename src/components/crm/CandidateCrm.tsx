'use client';

export function CandidateCrm() {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><i className="fa-solid fa-comments mr-2"></i>Candidate CRM & Touchpoint History</h2></div>
      <div className="p-5">
        <div className="grid grid-cols-[1fr_2fr] gap-5">
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <h3 className="mb-3 text-[0.9rem] font-bold">Talent Pool Segments</h3>
            <ul className="flex flex-col gap-2 list-none">
              <li className="rounded-md bg-[#eff6ff] px-3 py-2 text-[0.82rem] font-semibold text-[#2563eb]">⭐ Silver Medalists (Shortlisted)</li>
              <li className="rounded-md bg-[#ecfdf5] px-3 py-2 text-[0.82rem] font-semibold text-[#16a34a]">🚀 High Quality Active Pool</li>
              <li className="rounded-md bg-[#fef3c7] px-3 py-2 text-[0.82rem] font-semibold text-[#92400e]">💤 Passive Talent Pipeline</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[0.9rem] font-bold">Recent Candidate Touchpoints</h3>
            <ul className="flex flex-col gap-2.5 list-none">
              <li className="rounded-md border border-[#e2e8f0] p-3">
                <span className="text-[0.85rem] font-bold">📞 Phone Call with Ankit Verma</span>
                <p className="mt-1 text-[0.78rem] text-[#64748b]">Confirmed availability for L1 Video Interview on 15th Aug.</p>
              </li>
              <li className="rounded-md border border-[#e2e8f0] p-3">
                <span className="text-[0.85rem] font-bold">✉️ Email Offer Letter Sent to Priya Sharma</span>
                <p className="mt-1 text-[0.78rem] text-[#64748b]">Offer letter issued for ₹18 LPA CTC.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
