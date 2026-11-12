'use client';

import { AMMetric } from '../types';
import { Badge } from '@/components/ui/badge';

interface AmPerformanceProps {
  amMetrics: AMMetric[];
}

export function AmPerformance({ amMetrics }: AmPerformanceProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><span>Account Manager Responsiveness & TAT Metrics</span><Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">{amMetrics.length}</Badge></div>
        <span className="text-[0.8rem] text-[#64748b]">Intake to Allocation & Submission TAT</span>
      </div>
      <div>
        <table className="data-table">
          <thead><tr><th>Account Manager</th><th>Open Demands Managed</th><th>Intake-to-Allocation TAT</th><th>TA-to-Client Submission TAT</th><th>Offer Acceptance Rate</th></tr></thead>
          <tbody>
            {amMetrics.map(am => (
              <tr key={am.id}>
                <td className="font-semibold text-[#0f172a]">{am.name}</td><td>{am.openDemandsManaged} Demands</td>
                <td><Badge className="rounded border-transparent bg-[#f0fdf4] text-[0.75rem] font-semibold text-[#16a34a] hover:bg-[#f0fdf4]">{am.intakeToAllocationDays} Days</Badge></td>
                <td><Badge className="rounded border-transparent bg-[#eff6ff] text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{am.submissionToClientDays} Days</Badge></td>
                <td className="font-semibold text-[#16a34a]">{am.offerAcceptanceRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
