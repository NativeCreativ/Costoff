"use client";

import { ActivityLog } from "../types";
import { ActivityLogTable } from "@/components/ui/ActivityLogTable";
import { Badge } from "@/components/ui/badge";

interface ActivityLogsProps {
  logs: ActivityLog[];
}

export function ActivityLogs({ logs }: ActivityLogsProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Immutable Activity & Audit Log Feed</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {logs.length}
          </Badge>
        </div>
        <span className="text-[0.8rem] text-[#64748b]">
          Live System Audit Trail
        </span>
      </div>
      <div>
        <ActivityLogTable logs={logs} highlightAction />
      </div>
    </div>
  );
}
