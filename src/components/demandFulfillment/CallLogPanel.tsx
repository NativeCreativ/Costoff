'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { formatDateTime } from '@/lib/utils';
import { useDemandCallLogsQuery } from '@/queries/demandFulfillment/useCallLogAndInstructions';
import { LogCallModal } from './LogCallModal';

/**
 * Call Log on the Sourcing tab: every call made about a candidate for this demand, by anyone,
 * with its fitment result — and per-person totals (calls / fit / not fit), the "how many calls
 * each TA made" metric.
 */
export function CallLogPanel({ requestId }: { requestId: string }) {
  const query = useDemandCallLogsQuery(requestId);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const calls = query.data?.calls ?? [];
  const shown = showAll ? calls : calls.slice(0, 10);
  const totals = (query.data?.summary ?? []).reduce((t, s) => ({ calls: t.calls + s.calls, fit: t.fit + s.fit }), { calls: 0, fit: 0 });

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">
          <Phone className="h-3.5 w-3.5" /> Call Log
          {totals.calls > 0 && (
            <span className="ml-1 font-semibold normal-case tracking-normal text-[#64748b]">
              · {totals.calls} call{totals.calls === 1 ? '' : 's'}, {totals.fit} fit ({Math.round((totals.fit / totals.calls) * 100)}%)
            </span>
          )}
        </div>
        {query.data?.can_log && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <Phone className="h-3.5 w-3.5" /> Log a Call
          </Button>
        )}
      </div>

      {(query.data?.summary.length ?? 0) > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {query.data!.summary.map((s) => (
            <span key={s.user_id} className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 text-[0.74rem] text-[#334155]">
              <span className="font-semibold">{s.name}</span>: {s.calls} call{s.calls === 1 ? '' : 's'} · <span className="text-[#15803d]">{s.fit} fit</span> ·{' '}
              <span className="text-[#b91c1c]">{s.not_fit} not fit</span>
            </span>
          ))}
        </div>
      )}

      {query.isLoading ? (
        <Loader message="Loading calls…" size="sm" />
      ) : query.isError ? (
        <p className="text-[0.8rem] text-[#dc2626]">Couldn&apos;t load the call log.</p>
      ) : calls.length === 0 ? (
        <p className="text-[0.8rem] text-[#94a3b8]">No calls logged for this demand yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[720px] text-left text-[0.8rem]">
            <thead className="border-b border-[#e2e8f0] text-[0.7rem] font-bold uppercase tracking-[0.4px] text-[#64748b]">
              <tr>
                <th className="px-2 py-1.5">When</th>
                <th className="px-2 py-1.5">Candidate</th>
                <th className="px-2 py-1.5">Result</th>
                <th className="px-2 py-1.5">Notes</th>
                <th className="px-2 py-1.5">By</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b border-[#f1f5f9] align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 text-[#64748b]">{formatDateTime(c.created_at)}</td>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold text-[#0f172a]">{c.candidate?.full_name ?? '—'}</div>
                    <div className="text-[0.72rem] text-[#64748b]">{[c.candidate?.phone, c.candidate?.current_company, c.candidate?.total_experience].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    {c.outcome === 'fit' ? (
                      <Badge className="border-transparent bg-[#f0fdf4] text-[#15803d] hover:bg-[#f0fdf4]">Fit{c.moved_to_sourcing ? ' → Sourcing' : ''}</Badge>
                    ) : (
                      <>
                        <Badge className="border-transparent bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]">Not fit</Badge>
                        {c.fail_reason && <div className="mt-0.5 text-[0.72rem] text-[#64748b]">{c.fail_reason}</div>}
                      </>
                    )}
                  </td>
                  <td className="max-w-[260px] whitespace-pre-wrap px-2 py-1.5 text-[#475569]">{c.notes || '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[#475569]">{c.caller_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {calls.length > 10 && (
        <button type="button" className="mt-1 text-[0.75rem] font-semibold text-[#2563eb] hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${calls.length} calls`}
        </button>
      )}
      {open && <LogCallModal requestId={requestId} onClose={() => setOpen(false)} />}
    </div>
  );
}
