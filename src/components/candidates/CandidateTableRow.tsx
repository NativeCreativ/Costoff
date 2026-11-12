'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Candidate } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCompactCurrency } from '@/lib/utils';
import { candidateUrgency } from '@/lib/candidates/candidateUrgency';

interface CandidateTableRowProps {
  c: Candidate;
  editCandidateStage: string;
  renderStageTag: (stage: string) => React.ReactNode;
  openCandidateHistory: (candidateId: string) => void;
  onEdit: (c: Candidate) => void;
  onDeleteRequest: (c: Candidate) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (c: Candidate) => void;
}

export function CandidateTableRow({ c, editCandidateStage, renderStageTag, openCandidateHistory, onEdit, onDeleteRequest, selectable, selected, onToggleSelect }: CandidateTableRowProps) {
  const urgency = candidateUrgency(c);
  return (
    <tr className="align-top">
      {selectable && (
        <td className="whitespace-nowrap px-4 py-3">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(c)}
            className="h-4 w-4 cursor-pointer rounded border-[#cbd5e1]"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <button
          onClick={() => openCandidateHistory(c.id)}
          title="Click to view Candidate 360 Profile & Full Application History"
          className="cursor-pointer whitespace-nowrap border-none bg-none p-0 text-left text-[0.83rem] font-bold text-[#2563eb] underline"
        >
          {c.full_name}
        </button>
        {urgency && (
          <Badge
            title={urgency.reason}
            className={`ml-1.5 border-transparent text-[0.68rem] font-semibold ${
              urgency.level === 'high' ? 'bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]' : 'bg-[#fffbeb] text-[#92400e] hover:bg-[#fffbeb]'
            }`}
          >
            {urgency.label}
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#0f172a]">{c.email || '—'}</span>
          <span className="text-[#64748b]">{c.phone || '—'}</span>
        </div>
      </td>

      <td className="min-w-[180px] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{c.current_company || '—'}</span>
          <span className="text-[#475569]">{c.current_designation || '—'}</span>
          <span className="text-[0.78rem] text-[#64748b]">{c.current_location || '—'}</span>
        </div>
      </td>

      <td className="min-w-[180px] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{c.added_by_name || '—'}</span>
          {c.added_by_email && <span className="text-[0.78rem] text-[#64748b]">{c.added_by_email}</span>}
        </div>
      </td>

      <td className="min-w-[180px] px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-[#0f172a]">{c.total_experience || '—'}</span>
          {c.skills && c.skills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {c.skills.slice(0, 2).map((skill) => (
                <Badge
                  key={skill}
                  className="rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
                >
                  {skill}
                </Badge>
              ))}
              {c.skills.length > 2 && (
                <Badge
                  title={c.skills.slice(2).join(', ')}
                  className="cursor-default rounded border-transparent bg-[#f1f5f9] px-2 py-0.5 text-[0.72rem] font-semibold text-[#475569] hover:bg-[#e2e8f0]"
                >
                  +{c.skills.length - 2}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-[#94a3b8]">—</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-[#0f172a]">{formatCompactCurrency(c.current_ctc)}</span>
          <span className="text-[#94a3b8]">-</span>
          <span className="text-[#64748b]">{formatCompactCurrency(c.expected_ctc)}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        {c.work_mode ? (
          <Badge className="rounded border-transparent bg-[#f0f9ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#0369a1] hover:bg-[#f0f9ff]">
            {c.work_mode}
          </Badge>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge className="rounded border-transparent bg-[#f5f3ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#7c3aed] hover:bg-[#f5f3ff]">
          {c.source || '—'}
        </Badge>
      </td>

      <td className="px-4 py-3">{renderStageTag(editCandidateStage)}</td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            title="View Candidate"
            onClick={() => openCandidateHistory(c.id)}
            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#475569] hover:bg-white/80"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {/* Edit / Delete are DISABLED (not hidden) when this candidate was added by
              another recruiter on a shared demand, or by an AM/Super Admin — the server
              returns can_edit / edit_blocked_reason for exactly this, and the same value
              the PUT/DELETE routes enforce. The reason is surfaced in the tooltip. */}
          <Button
            variant="outline"
            size="icon"
            title={c.can_edit === false
              ? c.edit_blocked_reason || 'You do not have permission to edit this candidate'
              : 'Edit Candidate'}
            disabled={c.can_edit === false}
            onClick={() => onEdit(c)}
            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#2563eb] hover:bg-white/80 disabled:cursor-not-allowed disabled:border-[#e2e8f0] disabled:bg-[#f8fafc] disabled:text-[#cbd5e1]"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title={c.can_edit === false
              ? c.edit_blocked_reason || 'You do not have permission to delete this candidate'
              : 'Delete Candidate'}
            disabled={c.can_edit === false}
            onClick={() => onDeleteRequest(c)}
            className="h-8 w-8 rounded-md border-[#fee2e2] bg-[#fff5f5] text-[#dc2626] hover:bg-[#fff5f5]/80 disabled:cursor-not-allowed disabled:border-[#f1f5f9] disabled:bg-[#f8fafc] disabled:text-[#cbd5e1]"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
