'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { cn, formatScheduledDate } from '@/lib/utils';
import { candidateUrgency } from '@/lib/candidates/candidateUrgency';
import { useReadyToJoinReport } from '@/queries/reports/useReports';
import { Breadcrumb } from './ReportBits';

/**
 * Advanced Report 1 — candidates in our database who are ready to join (Immediate notice, or
 * available from today or earlier, and not already placed), by Skill Group. Click a group to see
 * it by location with the candidate list; click a location to narrow the list.
 */
export function ReadyToJoinReportView() {
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [location, setLocation] = useState<{ key: string; name: string } | null>(null);
  const query = useReadyToJoinReport(group?.id ?? null, location?.key ?? null);
  const data = query.data;

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        steps={[
          { label: 'All skill groups', onClick: group ? () => { setGroup(null); setLocation(null); } : undefined },
          ...(group ? [{ label: group.name, onClick: location ? () => setLocation(null) : undefined }] : []),
          ...(location ? [{ label: location.name }] : []),
        ]}
      />

      {query.isLoading ? (
        <Loader message="Building the report…" />
      ) : query.isError || !data ? (
        <p className="text-[0.85rem] text-[#dc2626]">Couldn&apos;t load the report.</p>
      ) : data.level === 'skill_group' ? (
        data.groups.length === 0 ? (
          <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No ready-to-join candidates right now.</p>
        ) : (
          <>
            <p className="text-[0.8rem] text-[#475569]">
              <span className="font-semibold text-[#0f172a]">{data.total}</span> candidates ready to join as of {formatScheduledDate(data.today)}.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup({ id: g.id, name: g.name })}
                  className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 text-left hover:border-[#2563eb] hover:bg-[#f8fafc]"
                >
                  <span className="font-semibold text-[#0f172a]">{g.name}</span>
                  <span className="text-[1.2rem] font-bold text-[#2563eb]">{g.count}</span>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by location">
            {data.locations.map((l) => (
              <button
                key={l.key}
                type="button"
                aria-pressed={location?.key === l.key}
                onClick={() => setLocation(location?.key === l.key ? null : { key: l.key, name: l.name })}
                className={cn(
                  'rounded-full border px-3 py-1 text-[0.78rem] font-medium',
                  location?.key === l.key ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
                )}
              >
                {l.name} · {l.count}
              </button>
            ))}
          </div>
          {data.candidates.length === 0 ? (
            <p className="py-10 text-center text-[0.85rem] text-[#94a3b8]">No candidates here.</p>
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-[880px] text-left text-[0.82rem]">
                <thead className="border-b border-[#e2e8f0] text-[0.72rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
                  <tr>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Experience</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Expected CTC</th>
                    <th className="px-3 py-2">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {data.candidates.map((c) => {
                    const urgency = candidateUrgency(c);
                    return (
                      <tr key={c.id} className="border-b border-[#f1f5f9] align-top">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-[#0f172a]">
                            {c.full_name}
                            {urgency && (
                              <Badge title={urgency.reason} className={cn('ml-1.5 border-transparent text-[0.66rem]', urgency.level === 'high' ? 'bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]' : 'bg-[#fffbeb] text-[#92400e] hover:bg-[#fffbeb]')}>
                                {urgency.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[0.75rem] text-[#64748b]">{[c.current_designation, c.current_company].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="px-3 py-2">{c.current_location || '—'}</td>
                        <td className="px-3 py-2">{c.total_experience || '—'}</td>
                        <td className="px-3 py-2">
                          {c.availability || '—'}
                          {c.available_from && <div className="text-[0.72rem] text-[#64748b]">from {formatScheduledDate(c.available_from)}</div>}
                        </td>
                        <td className="px-3 py-2">{c.expected_ctc ? `₹${c.expected_ctc.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="max-w-[240px] px-3 py-2 text-[#475569]">{c.skills.slice(0, 5).join(', ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.limited && <p className="text-[0.72rem] text-[#94a3b8]">Showing the first 300 candidates. Pick a location to narrow the list.</p>}
        </>
      )}
      <p className="text-[0.72rem] text-[#94a3b8]">
        Ready to join = notice period Immediate, or Available From today or earlier — and not already offer-accepted, onboarding or joined on any demand.
      </p>
    </div>
  );
}
