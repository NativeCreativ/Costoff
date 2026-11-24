'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatScheduledDate } from '@/lib/utils';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import { useTodaysInterviewsReport } from '@/queries/reports/useReports';

/**
 * Report 2 — the day's interviews with their current status (view only). Click a status to
 * drill into just those interviews; each row opens the demand's Selection tab.
 */
export function TodaysInterviewsReportView() {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState<boolean>(false);

  const query = useTodaysInterviewsReport({
    startDate: startDate || null,
    endDate: endDate || null,
    activeOnly,
  });

  const data = query.data;

  // Filter rows by status and optionally by the drilled-down day
  const rows = (data?.interviews ?? []).filter((iv) => {
    if (selectedDay && iv.scheduled_date && iv.scheduled_date !== selectedDay) return false;
    if (status && iv.status !== status) return false;
    return true;
  });

  const isRange = !!(startDate && endDate && startDate !== endDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-[0.72rem] font-semibold text-[#64748b]">
            From Date
            <Input
              type="date"
              className="h-9 w-[150px] bg-white"
              value={startDate ?? data?.startDate ?? data?.date ?? ''}
              onChange={(e) => {
                setStartDate(e.target.value || null);
                setSelectedDay(null);
                setStatus(null);
              }}
            />
          </label>
          <label className="flex flex-col text-[0.72rem] font-semibold text-[#64748b]">
            To Date
            <Input
              type="date"
              className="h-9 w-[150px] bg-white"
              value={endDate ?? data?.endDate ?? data?.date ?? ''}
              onChange={(e) => {
                setEndDate(e.target.value || null);
                setSelectedDay(null);
                setStatus(null);
              }}
            />
          </label>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[0.8rem] font-medium text-[#475569]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#2563eb]"
            />
            Active demands only
          </label>
        </div>

        {data && (
          <span className="text-[0.8rem] font-medium text-[#475569]">
            {data.total} interview{data.total === 1 ? '' : 's'} across {data.dailyCounts?.length ?? 1} day(s)
          </span>
        )}
      </div>

      {/* Review Comment 16: Daily Breakdown Bar in Date Range */}
      {data && data.dailyCounts && data.dailyCounts.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[#64748b]">
            Daily Breakdown (Click to drill in)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-left text-xs transition-all',
                !selectedDay ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e40af] font-semibold' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
              )}
            >
              All Days ({data.total})
            </button>
            {data.dailyCounts.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-all',
                  selectedDay === d.date ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e40af] font-semibold shadow-sm' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
                )}
              >
                <span>{formatScheduledDate(d.date)}</span>
                <Badge className="border-transparent bg-[#f1f5f9] px-1.5 py-0 text-[0.65rem] font-bold text-[#2563eb]">
                  {d.count}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.summary.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <button
            type="button"
            aria-pressed={!status}
            onClick={() => setStatus(null)}
            className={cn('rounded-lg border px-3 py-2 text-left', !status ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]')}
          >
            <div className="text-[1.1rem] font-bold text-[#0f172a]">{data.total}</div>
            <div className="text-[0.72rem] font-semibold text-[#64748b]">All Statuses</div>
          </button>
          {data.summary.map((s) => (
            <button
              key={s.status}
              type="button"
              aria-pressed={status === s.status}
              onClick={() => setStatus(status === s.status ? null : s.status)}
              className={cn('rounded-lg border px-3 py-2 text-left', status === s.status ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]')}
            >
              <div className="text-[1.1rem] font-bold text-[#0f172a]">{s.count}</div>
              <div className="text-[0.72rem] font-semibold text-[#64748b]">{s.status}</div>
            </button>
          ))}
        </div>
      )}

      {query.isLoading ? (
        <Loader message="Loading interviews…" />
      ) : query.isError ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the report.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No interviews on this date.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[880px] text-left text-[0.82rem]">
            <thead className="border-b border-[#e2e8f0] text-[0.72rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Demand / Client</th>
                <th className="px-3 py-2">Round</th>
                <th className="px-3 py-2">Type · Mode · Location</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((iv) => (
                <tr key={iv.id} className="border-b border-[#f1f5f9] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[#475569]">
                    {iv.start_time || '—'}{iv.end_time ? ` – ${iv.end_time}` : ''}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#0f172a]">{iv.candidate_name || '—'}</td>
                  <td className="px-3 py-2">
                    <Link href={demandDetailHref(iv.request_id, 'selection')} className="font-semibold text-[#2563eb] hover:underline">{iv.request_id}</Link>
                    <div className="text-[0.75rem] text-[#64748b]">{[iv.job_title, iv.client_name].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-2">{iv.round_name || '—'}</td>
                  <td className="px-3 py-2 text-[#475569]">
                    {[iv.interview_type, iv.mode, iv.interview_location === 'Direct_Call' ? 'Direct call' : iv.interview_location].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{iv.status}</Badge>
                    {iv.result && <div className="mt-0.5 text-[0.72rem] capitalize text-[#64748b]">Result: {iv.result}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
