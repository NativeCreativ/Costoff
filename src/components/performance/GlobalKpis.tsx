'use client';

import { GlobalKpiState } from '../types';

interface GlobalKpisProps {
  globalKpis: GlobalKpiState;
}

export function GlobalKpis({ globalKpis }: GlobalKpisProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6 text-center">
        <span className="mb-2 block text-[0.8rem] font-semibold text-[#64748b]">Average Time to Fill</span>
        <span className="text-2xl font-extrabold text-[#2563eb]">{globalKpis.avgTimeToFillDays || 24} Days</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6 text-center">
        <span className="mb-2 block text-[0.8rem] font-semibold text-[#64748b]">Average Time to Hire</span>
        <span className="text-2xl font-extrabold text-[#8b5cf6]">{globalKpis.avgTimeToHireDays || 18} Days</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6 text-center">
        <span className="mb-2 block text-[0.8rem] font-semibold text-[#64748b]">Offer Acceptance Rate</span>
        <span className="text-2xl font-extrabold text-[#16a34a]">{globalKpis.offerAcceptanceRatePct || 88}%</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6 text-center">
        <span className="mb-2 block text-[0.8rem] font-semibold text-[#64748b]">Interview Attendance Rate</span>
        <span className="text-2xl font-extrabold text-[#06b6d4]">{globalKpis.interviewAttendanceRatePct || 92}%</span>
      </div>
    </div>
  );
}
