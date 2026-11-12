'use client';

import { TAMetric } from '../types';
import { Badge } from '@/components/ui/badge';

interface RecruiterPerformanceProps {
  taMetrics: TAMetric[];
}

export function RecruiterPerformance({ taMetrics }: RecruiterPerformanceProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><span>Recruiter (TA) Target vs. Actual Metrics</span><Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">{taMetrics.length}</Badge></div>
        <span className="text-[0.8rem] text-[#64748b]">Target Threshold: 5 Submissions/Day</span>
      </div>
      <div>
        <table className="data-table">
          <thead><tr><th>Recruiter Name</th><th>Role</th><th>Demands Worked</th><th>Candidates Scoped</th><th>Submissions</th><th>Weekly Target %</th><th>Interviews Scheduled</th><th>Selections</th></tr></thead>
          <tbody>
            {taMetrics.map(ta => (
              <tr key={ta.id}>
                <td className="font-semibold text-[#0f172a]">{ta.name}</td>
                <td><Badge className="rounded border-transparent bg-[#eff6ff] text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{ta.role.toUpperCase()}</Badge></td>
                <td>{ta.demandsWorked}</td><td>{ta.candidatesScoped}</td><td className="font-semibold text-[#0f172a]">{ta.submissions}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded bg-[#e2e8f0]">
                      <div className="h-full" style={{ width: `${Math.min(100, ta.targetAchievedPct ?? 0)}%`, backgroundColor: (ta.targetAchievedPct ?? 0) >= 70 ? '#10b981' : '#f59e0b' }} />
                    </div>
                    <span className="text-[0.75rem] font-bold">{(ta.targetAchievedPct ?? 0)}%</span>
                  </div>
                </td>
                <td>{ta.interviewsScheduled}</td><td className="font-semibold text-[#16a34a]">{ta.selections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
