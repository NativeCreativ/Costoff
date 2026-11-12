'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportPhase } from '@/lib/reports/reportPhases';

export const PHASE_BAR_CLASSES: Record<ReportPhase, string> = {
  sourcing: 'bg-[#2563eb]',
  shortlist: 'bg-[#7c3aed]',
  selection: 'bg-[#0891b2]',
  onboarding: 'bg-[#16a34a]',
  other: 'bg-[#94a3b8]',
};

/** "12 (40%)" with a thin bar under it — one phase cell of Report 1. */
export function PhaseCell({ count, percent, phase }: { count: number; percent: number; phase: ReportPhase }) {
  return (
    <div className="min-w-[72px]">
      <div className="text-[0.82rem] text-[#0f172a]">
        <span className="font-semibold">{count}</span>
        <span className="ml-1 text-[0.72rem] text-[#64748b]">({percent}%)</span>
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-[#f1f5f9]">
        <div className={cn('h-1 rounded-full', PHASE_BAR_CLASSES[phase])} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

/** Drill-down trail: each earlier step is a button back to that level. */
export function Breadcrumb({ steps }: { steps: { label: ReactNode; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Report level" className="flex flex-wrap items-center gap-1 text-[0.8rem]">
      {steps.map((step, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" />}
          {step.onClick ? (
            <button type="button" className="font-semibold text-[#2563eb] hover:underline" onClick={step.onClick}>
              {step.label}
            </button>
          ) : (
            <span className="font-semibold text-[#0f172a]">{step.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
