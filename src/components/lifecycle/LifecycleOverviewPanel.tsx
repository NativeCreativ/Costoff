'use client';

import { Badge } from '@/components/ui/badge';
import { formatCompensationRange } from '@/lib/utils';

interface LifecycleOverviewPanelProps {
  demand: any;
  submissionsCount: number;
  interviewsCount: number;
  offersCount: number;
  onboardingsCount: number;
}

export function LifecycleOverviewPanel({ demand, submissionsCount, interviewsCount, offersCount, onboardingsCount }: LifecycleOverviewPanelProps) {
  return (
    <div className="flex w-[340px] min-w-[320px] flex-col gap-4 overflow-y-auto border-r border-[#e2e8f0] bg-[#f8fafc] p-5">
      <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">Req Overview</span>
          <Badge className={`border-transparent text-[0.75rem] font-bold ${demand.status !== 'Closure' ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]' : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]'}`}>
            {demand.status === 'Closure' ? 'Closed' : demand.status}
          </Badge>
        </div>
        <h3 className="mb-3 text-[1.05rem] font-bold leading-[1.4] text-[#0f172a]">{demand.skill_description}</h3>
        <div className="flex flex-col gap-2 text-[0.82rem] text-[#334155]">
          <div><strong>Client Name:</strong> <span className="font-bold text-[#0369a1]">{demand.client_name || 'Costaff Client'}</span></div>
          <div><strong>Account Manager:</strong> <span className="font-bold text-[#4338ca]">{demand.am_name || 'Unassigned'}</span></div>
          <div><strong>Role Category:</strong> {demand.role_category || 'Full Time'}</div>
          <div>
            <strong>Priority:</strong>{' '}
            {demand.priority === 'High' ? (
              <Badge variant="outline" className="border-[#fca5a5] bg-[#fef2f2] text-[0.72rem] font-semibold text-[#ef4444] hover:bg-[#fef2f2]">{demand.priority}</Badge>
            ) : (
              <span>{demand.priority}</span>
            )}
          </div>
          <div><strong>Days Open:</strong> {demand.days_open || 0} Days</div>
          <div><strong>Experience Level:</strong> {Array.isArray(demand.experience_levels) && demand.experience_levels.length > 0 ? demand.experience_levels.join(', ') : 'N/A'}</div>
          <div><strong>Positions:</strong> {demand.num_positions || 1}</div>
          <div>
            <strong>Compensation:</strong>{' '}
            {formatCompensationRange(demand.compensation_min, demand.compensation_max)}
          </div>
          <div><strong>Locations:</strong> {Array.isArray(demand.locations) ? demand.locations.join(', ') : 'N/A'}</div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#cbd5e1] bg-white p-4">
        <div className="mb-3 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Pipeline Summary</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-[#eff6ff] p-2.5 text-center">
            <div className="text-[1.3rem] font-extrabold text-[#1d4ed8]">{submissionsCount}</div>
            <div className="text-[0.72rem] font-semibold text-[#3b82f6]">Assigned Candidates</div>
          </div>
          <div className="rounded-lg bg-[#f3e8ff] p-2.5 text-center">
            <div className="text-[1.3rem] font-extrabold text-[#6b21a8]">{interviewsCount}</div>
            <div className="text-[0.72rem] font-semibold text-[#9333ea]">Interviews Logged</div>
          </div>
          <div className="rounded-lg bg-[#ecfdf5] p-2.5 text-center">
            <div className="text-[1.3rem] font-extrabold text-[#047857]">{offersCount}</div>
            <div className="text-[0.72rem] font-semibold text-[#10b981]">Offers Issued</div>
          </div>
          <div className="rounded-lg bg-[#e0f2fe] p-2.5 text-center">
            <div className="text-[1.3rem] font-extrabold text-[#0369a1]">{onboardingsCount}</div>
            <div className="text-[0.72rem] font-semibold text-[#0284c7]">Onboarded</div>
          </div>
        </div>
      </div>
    </div>
  );
}
