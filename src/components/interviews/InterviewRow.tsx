'use client';

import { useState } from 'react';
import { Eye, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { Interview } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatScheduledDate, formatScheduledTime } from '@/lib/utils';
import type { InterviewRowActions } from '@/lib/auth/interviewPermissions';

interface InterviewRowProps {
  item: Interview;
  openLifecycle: (reqId: string) => void;
  onDeleteRequest: (item: Interview) => void;
  getInterviewStatusStyle: (status: string) => { bg: string; text: string; border: string; dot: string; label: string };
  setSelectedInterview: (iv: Interview) => void;
  onEdit: (iv: Interview) => void;
  /** Resolved by the shared getInterviewRowActions() helper — role gate + status rule. */
  actions: InterviewRowActions;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (item: Interview) => void;
}

const RESULT_STYLE: Record<string, string> = {
  pass: 'bg-[#dcfce7] text-[#166534]',
  fail: 'bg-[#fee2e2] text-[#dc2626]',
  on_hold: 'bg-[#fef3c7] text-[#92400e]',
};

export function InterviewRow({
  item,
  openLifecycle,
  onDeleteRequest,
  getInterviewStatusStyle,
  setSelectedInterview,
  onEdit,
  actions,
  selectable,
  selected,
  onToggleSelect,
}: InterviewRowProps) {
  const statusStyle = getInterviewStatusStyle(item.status);
  const createdByName = item.profiles_interviews_created_byToprofiles?.full_name || item.created_by_name;
  const createdByEmail = item.profiles_interviews_created_byToprofiles?.email || item.created_by_email;
  const { canEdit, canDelete, editBlockedReason, deleteBlockedReason } = actions;

  const [linkCopied, setLinkCopied] = useState(false);

  const copyMeetingLink = () => {
    if (!item.meeting_link) return;
    navigator.clipboard.writeText(item.meeting_link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <tr className="align-middle">
      {selectable && (
        <td className="whitespace-nowrap px-4 py-3">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(item)}
            className="h-4 w-4 cursor-pointer rounded border-[#cbd5e1]"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {item.demand_request_id ? (
            <button
              onClick={() => openLifecycle(item.demand_request_id!)}
              title="Click to view full Requirement Lifecycle & Candidate History"
              className="cursor-pointer border-none bg-none p-0 text-left text-[0.83rem] font-bold text-[#2563eb] underline"
            >
              <i className="fa-solid fa-clock-rotate-left mr-1 text-[0.75rem]"></i>
              {item.demand_request_id}
            </button>
          ) : (
            <span className="text-[#94a3b8]">—</span>
          )}
          <span className="text-[0.78rem] text-[#475569]">{item.demand_job_title || '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{item.client_company_name || '—'}</span>
          <span className="text-[0.78rem] text-[#475569]">{item.client_name || '—'}</span>
          <span className="text-[0.78rem] text-[#64748b]">{item.client_company_email || '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {item.am_name ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[#0f172a]">{item.am_name}</span>
            <span className="text-[0.78rem] text-[#64748b]">{item.am_email || '—'}</span>
          </div>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{item.candidate_name || '—'}</span>
          {item.candidate_email && <span className="text-[0.78rem] text-[#64748b]">{item.candidate_email}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge className="rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{item.level || '—'}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{createdByName || '—'}</span>
          {createdByEmail && <span className="text-[0.78rem] text-[#64748b]">{createdByEmail}</span>}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {item.scheduled_date ? formatScheduledDate(item.scheduled_date) : '—'}
        {item.scheduled_time && ` · ${formatScheduledTime(item.scheduled_time)}`}
        {item.end_time && `–${formatScheduledTime(item.end_time)}`}
      </td>
      <td className="px-4 py-3">
        <Badge className="rounded border-transparent bg-[#f0fdf4] px-2 py-0.5 text-[0.72rem] font-semibold text-[#16a34a] hover:bg-[#f0fdf4]">{item.mode}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          className="rounded border px-2 py-0.5 text-[0.72rem] font-semibold hover:bg-inherit"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}
        >
          {statusStyle.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {item.result ? (
          <Badge className={`rounded border-transparent px-2 py-0.5 text-[0.72rem] font-semibold hover:bg-inherit ${RESULT_STYLE[item.result] ?? 'bg-[#f1f5f9] text-[#475569]'}`}>
            {item.result.replace(/_/g, ' ')}
          </Badge>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        )}
      </td>
      <td className="px-4 py-3"><Badge className="rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{item.link_status || '—'}</Badge></td>
      <td className="px-4 py-3">
        {item.meeting_link ? (
          <div className="flex max-w-[220px] items-center gap-1.5">
            <a
              href={item.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              title={item.meeting_link}
              className="truncate text-[0.8rem] text-[#2563eb] underline"
            >
              {item.meeting_link}
            </a>
            <button
              type="button"
              onClick={copyMeetingLink}
              title={linkCopied ? 'Copied!' : 'Copy meeting link'}
              className="shrink-0 text-[#94a3b8] hover:text-[#2563eb]"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5 text-[#16a34a]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {/* Unavailable actions are HIDDEN, never rendered disabled — there is no greyed-out
            icon sitting in the cell. The block reason is still carried on `actions` and is
            what the bulk flows report when they skip the row. */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            title="View Interview"
            onClick={() => setSelectedInterview(item)}
            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#475569] hover:bg-white/80"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              title={editBlockedReason || 'Edit Interview'}
              onClick={() => onEdit(item)}
              className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#2563eb] hover:bg-white/80"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="icon"
              title={deleteBlockedReason || 'Delete Interview'}
              onClick={() => onDeleteRequest(item)}
              className="h-8 w-8 rounded-md border-[#fee2e2] bg-[#fff5f5] text-[#dc2626] hover:bg-[#fff5f5]/80"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
