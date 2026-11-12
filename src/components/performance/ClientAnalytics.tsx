'use client';

import { ClientMetric } from '../types';
import { Badge } from '@/components/ui/badge';

interface ClientAnalyticsProps {
  clientMetrics: ClientMetric[];
}

export function ClientAnalytics({ clientMetrics }: ClientAnalyticsProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><span>Client Conversion Funnels & Source Analytics</span><Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">{clientMetrics.length}</Badge></div>
        <span className="text-[0.8rem] text-[#64748b]">Demands → Submissions → Interviews → Offers → Joins</span>
      </div>
      <div>
        <table className="data-table">
          <thead><tr><th>Client Name</th><th>Total Demands</th><th>Open Demands</th><th>Submissions</th><th>Interviews</th><th>Offers</th><th>Joins</th></tr></thead>
          <tbody>
            {clientMetrics.map(cm => (
              <tr key={cm.id}>
                <td className="font-semibold text-[#0f172a]">{cm.clientName}</td><td>{cm.totalDemands}</td><td>{cm.openDemands}</td><td>{cm.submissions}</td><td>{cm.interviews}</td><td>{cm.offers}</td><td className="font-semibold text-[#16a34a]">{cm.joins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
