'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PIPELINE_KANBAN_COLUMNS, SUBMISSION_STATUS_COLORS, submissionStatusLabel } from './statusStyles';
import { candidateUrgency } from '@/lib/candidates/candidateUrgency';
import type { DemandCandidate } from '@/components/types';

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

interface PipelineKanbanBoardProps {
  candidates: DemandCandidate[];
  canManage: boolean;
  onCardClick: (dc: DemandCandidate) => void;
  onOpenInterview?: (dc: DemandCandidate) => void;
  onDropOnColumn: (dc: DemandCandidate, toStatus: string) => void;
  onDropMultipleOnColumn: (dcs: DemandCandidate[], toStatus: string) => void;
  /** Ids of the checked cards. Owned by DemandPipelineTab, which renders the bulk
   *  "N selected / Move to / Clear" controls in the filter toolbar above the board —
   *  selection state therefore lives above the board, not inside it. */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function PipelineKanbanBoard({ candidates, canManage, onCardClick, onOpenInterview, onDropOnColumn, onDropMultipleOnColumn, selectedIds, onSelectionChange }: PipelineKanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragSourceIdsRef = useRef<Set<string>>(new Set());
  const dragCardRef = useRef<HTMLDivElement | null>(null);
  const headerCheckboxRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const byColumn = useMemo(() => {
    const map = new Map<string, DemandCandidate[]>();
    for (const col of PIPELINE_KANBAN_COLUMNS) map.set(col, []);
    for (const c of candidates) {
      if (!c.is_active) continue;
      const list = map.get(c.current_status);
      if (list) list.push(c);
      else map.set(c.current_status, [c]);
    }
    return map;
  }, [candidates]);

  const isDraggable = (dc: DemandCandidate) => canManage && dc.can_edit !== false;

  // Selection helpers — each mutates the parent-owned Set rather than local state.
  const toggleSelect = useCallback((id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const toggleSelectAll = useCallback((column: string, items: DemandCandidate[], checked: boolean) => {
    const next = new Set(selectedIds);
    for (const item of items) {
      if (checked) next.add(item.id);
      else next.delete(item.id);
    }
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const clearSelection = useCallback(() => onSelectionChange(new Set()), [onSelectionChange]);

  const handleDragStart = useCallback((e: React.DragEvent, dc: DemandCandidate, isMulti: boolean) => {
    if (!isDraggable(dc)) return;
    e.dataTransfer.setData('text/plain', dc.id);
    if (isMulti) {
      dragSourceIdsRef.current = new Set(selectedIds);
      e.dataTransfer.setData('application/x-multi-drag', 'true');
    } else {
      dragSourceIdsRef.current = new Set([dc.id]);
      e.dataTransfer.setData('application/x-multi-drag', 'false');
    }
    dragCardRef.current = e.currentTarget as HTMLDivElement;
  }, [selectedIds, isDraggable]);

  const handleDragEnd = useCallback(() => {
    dragSourceIdsRef.current.clear();
    dragCardRef.current = null;
  }, []);

  const getDragData = useCallback((e: React.DragEvent) => {
    const singleId = e.dataTransfer.getData('text/plain');
    const isMulti = e.dataTransfer.getData('application/x-multi-drag') === 'true';
    const ids = isMulti ? dragSourceIdsRef.current : new Set([singleId]);
    const dcs = candidates.filter(c => ids.has(c.id));
    return { ids, dcs, isMulti };
  }, [candidates]);

  const handleDrop = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const { dcs, isMulti } = getDragData(e);
    if (dcs.length === 0) return;
    if (isMulti) {
      onDropMultipleOnColumn(dcs, col);
    } else {
      onDropOnColumn(dcs[0], col);
    }
    clearSelection();
  }, [getDragData, onDropOnColumn, onDropMultipleOnColumn, clearSelection]);

  return (
    <>
      {/* 12 fixed-width columns are wider than any viewport, so the board scrolls
          horizontally. `kanban-scroll` keeps a visible (thin, muted) scrollbar instead of
          the old `scrollbar-hidden`, which left no hint that more columns were off-screen. */}
      <div className="kanban-scroll flex gap-3 overflow-x-auto">
        {PIPELINE_KANBAN_COLUMNS.map((col) => {
          const items = byColumn.get(col) || [];
          const colColor = SUBMISSION_STATUS_COLORS[col];
          const allSelected = items.length > 0 && items.every(dc => selectedIds.has(dc.id));
          const someSelected = items.some(dc => selectedIds.has(dc.id));
          const headerCheckboxKey = `header-${col}`;

          useEffect(() => {
            const input = headerCheckboxRefs.current.get(headerCheckboxKey);
            if (input) input.indeterminate = someSelected && !allSelected;
          }, [headerCheckboxKey, allSelected, someSelected]);

          return (
            <div
              key={col}
              onDragOver={canManage ? (e) => { e.preventDefault(); setDragOverColumn(col); } : undefined}
              onDragLeave={canManage ? () => setDragOverColumn((cur) => (cur === col ? null : cur)) : undefined}
              onDrop={canManage ? (e) => handleDrop(e, col) : undefined}
              className={`flex w-[260px] shrink-0 flex-col rounded-lg border bg-[#f8fafc] transition-colors ${dragOverColumn === col ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#e2e8f0]'}`}
            >
              <div className="flex items-center justify-between border-b border-[#e2e8f0] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <input
                      ref={(el) => {
                        if (el) headerCheckboxRefs.current.set(headerCheckboxKey, el);
                        else headerCheckboxRefs.current.delete(headerCheckboxKey);
                      }}
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectAll(col, items, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={items.length === 0}
                      className="h-4 w-4 rounded border-[#cbd5e1] text-[#2563eb] focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 cursor-pointer"
                      aria-label={`Select all in ${submissionStatusLabel(col)}`}
                    />
                  )}
                  <span className="text-[0.78rem] font-bold" style={{ color: colColor?.text || '#334155' }}>{submissionStatusLabel(col)}</span>
                  <Badge className="border-transparent bg-white text-[0.7rem] font-bold text-[#64748b] hover:bg-white">{items.length}</Badge>
                </div>
              </div>
              <div className="flex min-h-[80px] flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#e2e8f0] p-3 text-center text-[0.72rem] text-[#cbd5e1]">No candidates</div>
                ) : (
                  items.map((dc) => {
                    const isSelected = selectedIds.has(dc.id);
                    const isDraggableCard = isDraggable(dc);
                    const urgency = candidateUrgency(dc.candidates ?? {});
                    return (
                      <div
                        key={dc.id}
                        ref={isSelected ? dragCardRef : undefined}
                        draggable={isDraggableCard}
                        onDragStart={(e) => handleDragStart(e, dc, isSelected && selectedIds.size > 1)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          if (!isSelected) onCardClick(dc);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === ' ' && !isSelected) {
                            e.preventDefault();
                            onCardClick(dc);
                          }
                        }}
                        title={!isDraggableCard && dc.edit_blocked_reason ? dc.edit_blocked_reason : undefined}
                        className={`cursor-pointer rounded-md border bg-white p-2.5 shadow-sm hover:border-[#cbd5e1] hover:shadow transition-all ${
                          isDraggableCard ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } ${isSelected ? 'ring-2 ring-[#2563eb] border-[#2563eb] shadow-md' : 'border-[#e2e8f0]'}`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelect(dc.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#2563eb] focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 cursor-pointer shrink-0"
                            aria-label={`Select ${dc.candidates?.full_name || 'candidate'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[0.83rem] font-semibold text-[#0f172a] truncate max-w-[150px]">{dc.candidates?.full_name || 'Unnamed candidate'}</span>
                              {urgency && (
                                <Badge
                                  title={urgency.reason}
                                  className={`border-transparent px-1.5 py-0 text-[0.65rem] font-bold ${
                                    urgency.level === 'high' ? 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]' : 'bg-[#fef3c7] text-[#b45309] hover:bg-[#fef3c7]'
                                  }`}
                                >
                                  {urgency.label}
                                </Badge>
                              )}
                              {dc.sourcing_type === 'backup' && (
                                <Badge className="border-transparent bg-[#f1f5f9] px-1.5 py-0 text-[0.65rem] font-medium text-[#64748b] hover:bg-[#f1f5f9]">
                                  Backup
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem] text-[#94a3b8]">
                              <Badge className="border-transparent bg-[#f1f5f9] px-1.5 py-0 text-[0.65rem] font-semibold text-[#64748b] hover:bg-[#f1f5f9]">{dc.source.replace(/_/g, ' ')}</Badge>
                              <span>{daysSince(dc.updated_at || dc.created_at)}d in stage</span>
                            </div>
                            {dc.position_slot ? <div className="mt-1 text-[0.68rem] text-[#94a3b8]">Position #{dc.position_slot}</div> : null}
                            {onOpenInterview && ['customer_shortlisted', 'interview_scheduled', 'interviewed', 'selected'].includes(dc.current_status) && (
                              <button
                                type="button"
                                title="Manage Interviews"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenInterview(dc);
                                }}
                                className="mt-1.5 inline-flex items-center gap-1 rounded bg-[#eff6ff] px-1.5 py-0.5 text-[0.68rem] font-medium text-[#2563eb] hover:bg-[#dbeafe]"
                              >
                                <Calendar className="h-3 w-3" />
                                Interviews
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}