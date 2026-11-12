'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { MoreLessText } from '@/components/ui/MoreLessText';
import { cn, formatDateTime } from '@/lib/utils';
import { useDemandChangeLogQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import type { DemandChangeLogEntry } from '@/services/demandFulfillment.service';

const SCOPE_LABELS: Record<DemandChangeLogEntry['scope'], string> = {
  demand: 'Demand details',
  candidate: 'Candidate',
  assignment: 'Assignment',
  status: 'Status',
};

const SCOPE_CLASSES: Record<DemandChangeLogEntry['scope'], string> = {
  demand: 'bg-[#eff6ff] text-[#1d4ed8]',
  candidate: 'bg-[#f0fdf4] text-[#15803d]',
  assignment: 'bg-[#faf5ff] text-[#7e22ce]',
  status: 'bg-[#fff7ed] text-[#c2410c]',
};

const SCOPE_OPTIONS = (Object.keys(SCOPE_LABELS) as DemandChangeLogEntry['scope'][]).map((value) => ({ value, label: SCOPE_LABELS[value] }));

/**
 * Change Log tab: everything that changed on the demand, newest first — its own fields, its
 * candidates' details and pipeline/onboarding events (all phases), assignments and status.
 * Read-only; visible to anyone who can view the demand.
 */
export function DemandChangeLogPanel({ requestId }: { requestId: string }) {
  const query = useDemandChangeLogQuery(requestId);
  const [scope, setScope] = useState('');
  const entries = useMemo(
    () => (query.data ?? []).filter((entry) => !scope || entry.scope === scope),
    [query.data, scope]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8rem] text-[#64748b]">Every change to this demand, its candidates and its team, newest first.</p>
        <FilterSelect value={scope} onChange={setScope} options={SCOPE_OPTIONS} allLabel="All changes" />
      </div>
      {query.isLoading ? (
        <Loader message="Loading the change log…" />
      ) : query.isError ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the change log.</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-[0.85rem] text-[#94a3b8]">No changes recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[0.8rem]">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[0.72rem] uppercase tracking-wide text-[#94a3b8]">
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">What changed</th>
                <th className="px-3 py-2 font-semibold">From</th>
                <th className="px-3 py-2 font-semibold">To</th>
                <th className="px-3 py-2 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[#f1f5f9] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[#64748b]">{formatDateTime(entry.at)}</td>
                  <td className="px-3 py-2">
                    <Badge className={cn('border-transparent text-[0.7rem] font-semibold hover:bg-inherit', SCOPE_CLASSES[entry.scope])}>
                      {SCOPE_LABELS[entry.scope]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-[#0f172a]">
                    <span className="font-semibold">{entry.field}</span>
                    {entry.subject && entry.scope === 'candidate' && <div className="text-[0.75rem] text-[#64748b]">{entry.subject}</div>}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-[#64748b]">
                    {entry.old_value ? <MoreLessText text={entry.old_value} wordLimit={20} charLimit={160} /> : '—'}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-[#0f172a]">
                    {entry.new_value ? <MoreLessText text={entry.new_value} wordLimit={20} charLimit={160} /> : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#475569]">{entry.actor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
