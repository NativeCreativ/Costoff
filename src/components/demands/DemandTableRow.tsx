'use client';

import { Eye, Pencil, Trash2, AlertCircle, Copy } from 'lucide-react';
import { Demand } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * First `limit` words of `text`, with an ellipsis when anything was dropped.
 * Unlike MoreLessText this never renders a toggle — it is a fixed-height list
 * cell, so the preview is read-only and the full description opens on the detail page.
 */
function truncateToWords(text: string, limit: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return `${words.slice(0, limit).join(' ')}...`;
}

interface DemandTableRowProps {
  item: Demand;
  canEdit?: boolean;
  canDelete?: boolean;
  deleteDisabledReason?: string;
  /** Whether to OFFER Clone on this row. Same ownership rule as Edit, and deliberately NOT
   *  dependent on status — any demand the user may edit can be cloned. Server re-enforced. */
  canClone?: boolean;
  openLifecycle: (reqId: string) => void;
  onEdit: (item: Demand) => void;
  onDeleteRequest: (item: Demand) => void;
  onCloneRequest: (item: Demand) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (item: Demand) => void;
}

export function DemandTableRow({ item, canEdit, canDelete, deleteDisabledReason, canClone, openLifecycle, onEdit, onDeleteRequest, onCloneRequest, selectable, selected, onToggleSelect }: DemandTableRowProps) {
  return (
    <tr className="align-top">
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
      <td className="whitespace-nowrap px-4 py-3">
        <button
          onClick={() => openLifecycle(item.request_id)}
          title="Click to view full Requirement Lifecycle & Candidate History"
          className="cursor-pointer whitespace-nowrap border-none bg-none p-0 text-left text-[0.78rem] font-bold text-[#2563eb] underline"
        >
          {item.request_id}
        </button>
        {item.cloned_from_demand_id && (
          <Badge
            title={`Cloned from ${item.cloned_from_request_id ?? 'a Closed Demand'}${item.cloned_by_name ? ` by ${item.cloned_by_name}` : ''}`}
            className="ml-1.5 inline-flex items-center gap-1 rounded border-transparent bg-[#eef2ff] px-1.5 py-0.5 align-middle text-[0.68rem] font-semibold text-[#4338ca] hover:bg-[#eef2ff]"
          >
            <Copy className="h-2.5 w-2.5" />
            Cloned
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#0f172a]">{item.company_name || '—'}</span>
          <span className="text-[#475569]">{item.client_name || '—'}</span>
          {item.company_email && <span className="text-[0.78rem] text-[#64748b]">{item.company_email}</span>}
        </div>
      </td>

      <td className="min-w-[220px] px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[#0f172a]">{item.job_title || '—'}</span>
          {/* Read-only preview: the first 40 words and nothing else — the row has no
              room for an expander, and the full text lives on the detail page. */}
          {item.skill_description && (
            <span className="text-[#475569]">{truncateToWords(item.skill_description, 40)}</span>
          )}
        </div>
      </td>

      <td className="min-w-[180px] px-4 py-3">
        {item.technology_stack && item.technology_stack.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {item.technology_stack.slice(0, 2).map((skill) => (
              <Badge
                key={skill}
                className="rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
              >
                {skill}
              </Badge>
            ))}
            {item.technology_stack.length > 2 && (
              <Badge
                title={item.technology_stack.slice(2).join(', ')}
                className="cursor-default rounded border-transparent bg-[#f1f5f9] px-2 py-0.5 text-[0.72rem] font-semibold text-[#475569] hover:bg-[#e2e8f0]"
              >
                +{item.technology_stack.length - 2}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-[#94a3b8]">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge className="rounded border-transparent bg-[#f0f9ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#0369a1] hover:bg-[#f0f9ff]">
          {item.role_category || 'Full Time'}
        </Badge>
      </td>

      <td className="px-4 py-3">
        {item.priority === 'High' ? (
          <Badge variant="outline" className="border-[#fca5a5] bg-[#fef2f2] px-[9px] py-[3px] text-[0.72rem] font-semibold text-[#ef4444] hover:bg-[#fef2f2]">
            {item.priority}
          </Badge>
        ) : (
          <span>{item.priority}</span>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge className={`rounded border-transparent px-2 py-0.5 text-[0.75rem] font-semibold ${item.status === 'Closure' ? 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#f1f5f9]' : 'bg-[#ecfdf5] text-[#10b981] hover:bg-[#ecfdf5]'}`}>
          {item.status === 'Closure' ? 'Closed' : item.status}
        </Badge>
      </td>

      <td className="px-4 py-3">
        {item.is_red_flag ? (
          <Badge className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded border-transparent bg-[#fee2e2] px-[9px] py-0.5 text-[0.74rem] font-bold text-[#dc2626] hover:bg-[#fee2e2]">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {item.days_open} Days
          </Badge>
        ) : (
          <span className="whitespace-nowrap">{item.days_open} Days</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span>{item.am_name || <span className="text-[#94a3b8]">Unassigned</span>}</span>
          {item.spoc_name && <span className="text-[0.78rem] text-[#7c3aed]">SPOC: {item.spoc_name}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        {item.recruiter_names && item.recruiter_names.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.recruiter_names.map((name, index) => (
              <Badge
                key={`${name}-${index}`}
                className="rounded border-transparent bg-[#f5f3ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#7c3aed] hover:bg-[#f5f3ff]"
              >
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-[#94a3b8]">Unassigned</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            title="View Requirement"
            onClick={() => openLifecycle(item.request_id)}
            className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#475569] hover:bg-white/80"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              title="Edit Demand"
              onClick={() => onEdit(item)}
              className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#2563eb] hover:bg-white/80"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              title={canDelete ? "Delete Demand" : deleteDisabledReason}
              disabled={!canDelete}
              onClick={() => canDelete && onDeleteRequest(item)}
              className={`h-8 w-8 rounded-md ${canDelete ? "border-[#fee2e2] bg-[#fff5f5] text-[#dc2626] hover:bg-[#fff5f5]/80" : "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#cbd5e1]"}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {/* Always rendered whenever the user may edit the Demand, in ANY status — the same Company
              often needs several similar requirements, so an existing demand's configuration is
              reusable as the starting point for another. */}
          {canClone && (
            <Button
              variant="outline"
              size="icon"
              title="Clone Demand — creates a new Requirement pre-filled from this one (no candidates, interviews or history are carried over)"
              onClick={() => onCloneRequest(item)}
              className="h-8 w-8 rounded-md border-[#cbd5e1] bg-white text-[#4338ca] hover:bg-white/80"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
