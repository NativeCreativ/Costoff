"use client";

import { Onboarding } from "../types";
import { OnboardingRow } from "./OnboardingRow";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { TableEmpty } from "@/components/ui/TableEmpty";

const TABLE_COLUMNS = 7;

interface OnboardingsTableProps {
  onboardings: Onboarding[];
  loadingOnboardings: boolean;
  openLifecycle: (reqId: string) => void;
}

export function OnboardingsTable({
  onboardings,
  loadingOnboardings,
  openLifecycle,
}: OnboardingsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Onboarding Log</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {onboardings.length}
          </Badge>
        </div>
      </div>
      <div className="table-scroll">
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              <th className="px-4 py-3">Candidate & Demand</th>
              <th className="px-4 py-3">Offered CTC</th>
              <th className="px-4 py-3">BGV Status</th>
              <th className="px-4 py-3">Joining Date</th>
              <th className="px-4 py-3">Onboarding Status</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {loadingOnboardings ? (
              <TableSkeleton columns={TABLE_COLUMNS} padded />
            ) : onboardings.length === 0 ? (
              <TableEmpty colSpan={TABLE_COLUMNS}>
                No onboardings recorded yet or matching your BGV filter.
              </TableEmpty>
            ) : (
              onboardings.map((onboarding) => (
                <OnboardingRow
                  key={onboarding.id}
                  ob={onboarding}
                  openLifecycle={openLifecycle}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
