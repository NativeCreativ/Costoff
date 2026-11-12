'use client';

import { Badge } from '@/components/ui/badge';

export function WhatsappCampaigns() {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><i className="fa-brands fa-whatsapp mr-2"></i>WhatsApp Campaigns & DLT Templates</h2></div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-[#e2e8f0] p-4">
            <h3 className="text-[0.85rem] font-bold">🎂 Candidate Birthday Greeting</h3>
            <p className="my-1.5 text-[0.78rem] text-[#64748b]">Automated WhatsApp greeting on candidate birthday.</p>
            <Badge className="rounded border-transparent bg-[#dcfce7] text-[0.72rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Active DLT Template</Badge>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] p-4">
            <h3 className="text-[0.85rem] font-bold">📅 Interview Reminder Alert</h3>
            <p className="my-1.5 text-[0.78rem] text-[#64748b]">Sent 2 hours before scheduled video interview.</p>
            <Badge className="rounded border-transparent bg-[#dcfce7] text-[0.72rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Active DLT Template</Badge>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] p-4">
            <h3 className="text-[0.85rem] font-bold">🚀 Candidate Nurture Drip</h3>
            <p className="my-1.5 text-[0.78rem] text-[#64748b]">Monthly job opening alerts for passive talent pool.</p>
            <Badge className="rounded border-transparent bg-[#eff6ff] text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">Scheduled</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
