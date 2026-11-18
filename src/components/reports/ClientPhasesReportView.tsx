'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui/Loader';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import { demandStatusLabel } from '@/lib/demands/demandStatusLabel';
import { DEMAND_RED_FLAG_DAYS } from '@/lib/demandFulfillment/constants';
import { REPORT_PHASES, REPORT_PHASE_LABELS } from '@/lib/reports/reportPhases';
import { useClientPhasesReport } from '@/queries/reports/useReports';
import { Breadcrumb, PhaseCell } from './ReportBits';

/** Demand tab each phase column opens in the drill-down ("other" has no tab of its own). */
const PHASE_TAB: Record<string, string> = { sourcing: 'sourcing', shortlist: 'shortlist', selection: 'selection', onboarding: 'onboarding' };

/**
 * Report 1 — client-wise demand progress: candidates in each phase (count + % of that client's
 * candidates). Click a client to see the same per demand; a phase figure there opens that tab
 * of the demand.
 */
export function ClientPhasesReportView() {
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const query = useClientPhasesReport(client?.id ?? null, includeClosed);
  const data = query.data;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          steps={[
            { label: 'All clients', onClick: client ? () => setClient(null) : undefined },
            ...(client ? [{ label: client.name }] : []),
          ]}
        />
        <label className="flex items-center gap-2 text-[0.8rem] text-[#475569]">
          <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
          Include closed / cancelled demands
        </label>
      </div>

      {query.isLoading ? (
        <Loader message="Building the report…" />
      ) : query.isError || !data ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the report.</p>
      ) : data.rows.length === 0 ? (
        <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No demands to report on.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[900px] text-left text-[0.82rem]">
            <thead className="border-b border-[#e2e8f0] text-[0.72rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
              <tr>
                {data.level === 'client' ? (
                  <>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Demands</th>
                    <th className="px-3 py-2" title="Average / oldest days open across the client's demands">Aging (avg / oldest)</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2">Demand</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Days open</th>
                  </>
                )}
                <th className="px-3 py-2">Positions</th>
                <th className="px-3 py-2">Candidates</th>
                {REPORT_PHASES.map((phase) => (
                  <th key={phase} className="px-3 py-2">{REPORT_PHASE_LABELS[phase]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.level === 'client'
                ? data.rows.map((row) => (
                    <tr
                      key={row.company_id}
                      className="cursor-pointer border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                      onClick={() => setClient({ id: row.company_id, name: row.client_name })}
                    >
                      <td className="px-3 py-2 font-semibold text-[#2563eb]">{row.client_name}</td>
                      <td className="px-3 py-2">{row.demands}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {row.avg_days_open}d / {row.max_days_open}d
                        {row.red_flag_demands > 0 && (
                          <span className="ml-1.5 rounded bg-[#fef2f2] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[#dc2626]" title={`Demands open more than ${DEMAND_RED_FLAG_DAYS} days`}>
                            {row.red_flag_demands} over {DEMAND_RED_FLAG_DAYS}d
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.positions}</td>
                      <td className="px-3 py-2 font-semibold">{row.counts.total}</td>
                      {REPORT_PHASES.map((phase) => (
                        <td key={phase} className="px-3 py-2">
                          <PhaseCell phase={phase} count={row.counts[phase]} percent={row.percents[phase]} />
                        </td>
                      ))}
                    </tr>
                  ))
                : data.rows.map((row) => (
                    <tr key={row.id} className="border-b border-[#f1f5f9]">
                      <td className="px-3 py-2">
                        <Link href={demandDetailHref(row.request_id)} className="font-semibold text-[#2563eb] hover:underline">
                          {row.request_id}
                        </Link>
                        {row.job_title && <div className="text-[0.75rem] text-[#64748b]">{row.job_title}</div>}
                      </td>
                      <td className="px-3 py-2">{row.status ? demandStatusLabel(row.status) : '—'}</td>
                      <td className={`px-3 py-2 ${row.days_open > DEMAND_RED_FLAG_DAYS ? 'font-semibold text-[#dc2626]' : ''}`}>{row.days_open}d</td>
                      <td className="px-3 py-2">{row.positions}</td>
                      <td className="px-3 py-2 font-semibold">{row.counts.total}</td>
                      {REPORT_PHASES.map((phase) => (
                        <td key={phase} className="px-3 py-2">
                          {PHASE_TAB[phase] && row.counts[phase] > 0 ? (
                            <Link href={demandDetailHref(row.request_id, PHASE_TAB[phase])} className="block hover:opacity-80" title={`Open the ${REPORT_PHASE_LABELS[phase]} tab`}>
                              <PhaseCell phase={phase} count={row.counts[phase]} percent={row.percents[phase]} />
                            </Link>
                          ) : (
                            <PhaseCell phase={phase} count={row.counts[phase]} percent={row.percents[phase]} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.72rem] text-[#94a3b8]">
        % = share of that row&apos;s candidates. {data?.level === 'client' ? 'Click a client to see its demands.' : 'Click a phase figure to open that tab of the demand.'}
      </p>
    </div>
  );
}
