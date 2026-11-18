'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui/Loader';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import { PHASE_LABELS } from '@/lib/candidates/phaseAging';
import { useCandidateAgingReport } from '@/queries/reports/useReports';
import { cn } from '@/lib/utils';

const PHASES = Object.keys(PHASE_LABELS) as (keyof typeof PHASE_LABELS)[];

/**
 * Candidate Aging (review batch 5): every candidate in an open demand's pipeline, with the days
 * in their current phase (longest first) and the days spent in each earlier phase.
 */
export function CandidateAgingReportView() {
  const [phase, setPhase] = useState<string | null>(null);
  const query = useCandidateAgingReport(phase);
  const rows = query.data?.rows ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Phase">
        {[null, ...PHASES].map((p) => (
          <button
            key={p ?? 'all'}
            type="button"
            aria-pressed={phase === p}
            onClick={() => setPhase(p)}
            className={cn('rounded-full border px-3 py-1 text-[0.78rem]', phase === p ? 'border-[#2563eb] bg-[#eff6ff] font-semibold text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]')}
          >
            {p ? PHASE_LABELS[p] : 'All phases'}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Loader message="Building the report…" />
      ) : query.isError ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the report.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No candidates in this phase.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[900px] text-left text-[0.82rem]">
            <thead className="border-b border-[#e2e8f0] text-[0.7rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
              <tr>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Demand</th>
                <th className="px-3 py-2">Current phase</th>
                <th className="px-3 py-2 text-right">Days in phase</th>
                {PHASES.map((p) => <th key={p} className="px-3 py-2 text-right">{PHASE_LABELS[p]}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.submission_id} className="border-b border-[#f1f5f9]">
                  <td className="px-3 py-2 font-semibold text-[#0f172a]">{r.candidate_name}</td>
                  <td className="px-3 py-2">
                    <Link href={demandDetailHref(r.request_id, r.current_phase ?? undefined)} className="font-semibold text-[#2563eb] hover:underline">{r.request_id}</Link>
                    <div className="text-[0.72rem] text-[#64748b]">{[r.job_title, r.client_name].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.current_phase ? PHASE_LABELS[r.current_phase as keyof typeof PHASE_LABELS] : '—'}
                    <div className="text-[0.72rem] text-[#64748b]">{r.status.replace(/_/g, ' ')}</div>
                  </td>
                  <td className={cn('px-3 py-2 text-right font-semibold', r.days_in_current_phase > 14 ? 'text-[#dc2626]' : r.days_in_current_phase > 7 ? 'text-[#b45309]' : 'text-[#0f172a]')}>
                    {r.days_in_current_phase}d
                  </td>
                  {PHASES.map((p) => (
                    <td key={p} className="px-3 py-2 text-right text-[#475569]">{r.days_by_phase[p] != null ? `${r.days_by_phase[p]}d` : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.72rem] text-[#94a3b8]">
        Days count from the moment the candidate entered the phase. Amber after 7 days, red after 14.{query.data?.truncated ? ' Showing the oldest 500.' : ''}
      </p>
    </div>
  );
}
