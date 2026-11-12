'use client';

import type { SourceEffectivenessRow } from '../dashboard/dashboardTypes';

/**
 * Source Effectiveness (ROW 4, right card).
 *
 * One row per candidates.source, all from the real query: the source
 * name (84px), a 14px / radius-4 bar on a #f1f5f9 track whose width is
 * relative to the largest source, the bold candidate count, and the
 * percentage of those candidates with at least one submission.
 *
 * The best-converting source (highest % submitted) renders its bar and
 * its % in teal (#0d9488, bold); every other bar is #2563eb with a
 * muted %.
 */

export function SourceChart({ sources }: { sources: SourceEffectivenessRow[] }) {
  const maxCount = Math.max(...sources.map((s) => s.count), 0);

  return (
    <div className="space-y-2.5">
      {sources.map((source) => (
        <div key={source.source} className="flex items-center gap-2.5">
          <span className="w-[84px] shrink-0 text-[12.5px] text-[#475569]">
            {source.label}
          </span>
          <div className="h-[14px] min-w-0 flex-1 overflow-hidden rounded bg-[#f1f5f9]">
            <div
              className="h-full rounded"
              style={{
                width: maxCount > 0 ? `${(source.count / maxCount) * 100}%` : '0%',
                backgroundColor: source.isBest ? '#0d9488' : '#2563eb',
                borderRadius: 4,
              }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-[13px] font-bold text-[#0f172a]">
            {source.count.toLocaleString('en-US')}
          </span>
          <span
            className={`w-12 shrink-0 text-right text-xs ${
              source.isBest ? 'font-bold text-[#0d9488]' : 'text-[#64748b]'
            }`}
          >
            {source.submittedPct}%
          </span>
        </div>
      ))}
    </div>
  );
}
