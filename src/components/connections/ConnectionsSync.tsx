'use client';

import { Demand } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ConnectionsSyncProps {
  demands: Demand[];
}

export function ConnectionsSync({ demands }: ConnectionsSyncProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><i className="fa-solid fa-globe mr-2"></i>Careers Website Job Sync Engine</h2></div>
      <div>
        <table className="data-table">
          <thead><tr><th>Request ID</th><th>Skill Description</th><th>Public Careers Page Status</th><th>Inbound Applications</th><th>Actions</th></tr></thead>
          <tbody>
            {demands.slice(0, 5).map(d => (
              <tr key={d.id}>
                <td className="font-semibold text-[#2563eb]">{d.request_id}</td>
                <td>{d.skill_description}</td>
                <td><Badge className="rounded border-transparent bg-[#ecfdf5] text-[0.75rem] font-semibold text-[#10b981] hover:bg-[#ecfdf5]">Published to Website</Badge></td>
                <td><span className="font-bold text-[#0f172a]">14 Applications</span></td>
                <td><Button variant="outline" className="h-auto rounded border-[#e2e8f0] bg-white px-2.5 py-1 text-[0.75rem] font-normal hover:bg-white/80">Sync Now</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
