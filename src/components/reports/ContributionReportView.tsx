'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui/Loader';
import { Input } from '@/components/ui/input';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import { CONTRIBUTION_LABELS, CONTRIBUTION_METRICS, type ContributionMetric } from '@/lib/reports/contribution';
import { todayInIndia } from '@/components/teamWork/teamWork.schema';
import { useContributionReport } from '@/queries/reports/useReports';
import { Breadcrumb } from './ReportBits';

const ROLE_LABEL: Record<string, string> = { super_admin: 'Delivery Head', account_manager: 'AM', spoc: 'SPOC', ta: 'Recruiter' };

/**
 * Team Contribution (review batch 5): what each person did across demands in a date range —
 * calls, Demand Matches, profiles added / submitted / approved, customer shortlists, interviews,
 * selections, joinings. Click a person for the same numbers per demand. The Delivery Head sees
 * everyone; anyone else sees their own contribution.
 */
export function ContributionReportView() {
  const today = todayInIndia();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const query = useContributionReport(from, to, person?.id ?? null);
  const data = query.data;

  const cells = (counts: Record<ContributionMetric, number>) =>
    CONTRIBUTION_METRICS.map((m) => (
      <td key={m} className={`px-3 py-2 text-right ${counts[m] ? 'font-semibold text-[#0f172a]' : 'text-[#cbd5e1]'}`}>{counts[m]}</td>
    ));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Breadcrumb
          steps={
            data?.level === 'demand' && !data.can_see_all
              ? [{ label: `My contribution` }]
              : [{ label: 'Everyone', onClick: person ? () => setPerson(null) : undefined }, ...(person ? [{ label: person.name }] : [])]
          }
        />
        <div className="flex items-end gap-2">
          <label className="text-[0.75rem] text-[#475569]">From<Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-8" /></label>
          <label className="text-[0.75rem] text-[#475569]">To<Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-8" /></label>
        </div>
      </div>

      {query.isLoading ? (
        <Loader message="Building the report…" />
      ) : query.isError || !data ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the report.</p>
      ) : data.rows.length === 0 ? (
        <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No activity in this date range.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[1000px] text-left text-[0.82rem]">
            <thead className="border-b border-[#e2e8f0] text-[0.7rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
              <tr>
                <th className="px-3 py-2">{data.level === 'user' ? 'Person' : 'Demand'}</th>
                {CONTRIBUTION_METRICS.map((m) => <th key={m} className="px-3 py-2 text-right">{CONTRIBUTION_LABELS[m]}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.level === 'user'
                ? data.rows.map((row) => (
                    <tr key={row.user_id} className="cursor-pointer border-b border-[#f1f5f9] hover:bg-[#f8fafc]" onClick={() => setPerson({ id: row.user_id, name: row.name })}>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-[#2563eb]">{row.name}</span>
                        <span className="ml-1.5 text-[0.72rem] text-[#64748b]">{ROLE_LABEL[row.role] ?? row.role}</span>
                      </td>
                      {cells(row.counts)}
                    </tr>
                  ))
                : data.rows.map((row) => (
                    <tr key={row.demand_id} className="border-b border-[#f1f5f9]">
                      <td className="px-3 py-2">
                        <Link href={demandDetailHref(row.request_id)} className="font-semibold text-[#2563eb] hover:underline">{row.request_id}</Link>
                        <div className="text-[0.72rem] text-[#64748b]">{[row.job_title, row.client_name].filter(Boolean).join(' · ')}</div>
                      </td>
                      {cells(row.counts)}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.72rem] text-[#94a3b8]">
        Counted by who did it and when (India dates). {data?.level === 'user' ? 'Click a person to see it per demand.' : ''}
      </p>
    </div>
  );
}
