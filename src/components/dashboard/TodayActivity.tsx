'use client';

import { ActivityLog } from '../types';
import { ActivityLogTable } from '@/components/ui/ActivityLogTable';

interface TodayActivityProps {
  logs: ActivityLog[];
}

export function TodayActivity({ logs }: TodayActivityProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">Today's Activity Audit Stream</h2></div>
      <div>
        <ActivityLogTable logs={logs} />
      </div>
    </div>
  );
}
