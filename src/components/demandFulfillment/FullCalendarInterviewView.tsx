'use client';

import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormSelect } from '@/components/ui/FormSelect';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarInterviewsQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useUpdateInterviewMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import {
  INTERVIEW_COMPLETED_STATUS,
  INTERVIEW_RESULT_OPTIONS,
} from '@/constants/options';
import { useInterviewStatusOptions } from '@/components/interviews/useInterviewStatusOptions';
import type { DemandInterview } from '@/components/types';
import { getInterviewRowActions } from '@/lib/auth/interviewPermissions';
import { formatScheduledDate, formatScheduledTime } from '@/lib/utils';
import { formatSourceLabel } from '@/lib/candidates/sourceLabels';

const RESULT_OPTIONS = [{ value: '', label: 'Select result…' }, ...INTERVIEW_RESULT_OPTIONS];

const STATUS_COLOR: Record<string, string> = {
  Scheduled: '#3b82f6',
  Completed: '#10b981',
  'Candidate No-Show': '#ef4444',
  'Client No-Show': '#f59e0b',
  Rescheduled: '#a855f7',
  Cancelled: '#94a3b8',
};

interface FullCalendarInterviewViewProps {
  /** Restricts the feed to one demand's interviews (used from the demand detail Interviews tab). Omit for the global /interviews calendar. */
  demandId?: string;
}

/**
 * View-only internal calendar (no drag-to-reschedule, no external/Google Calendar sync) per the spec.
 *
 * Edit affordance is decided PER EVENT through the shared getInterviewRowActions() helper —
 * never from a page-level role check, and never from the event's status. That helper combines
 * the feed's `can_manage` flag (computed server-side by canEditInterview — the same predicate
 * PATCH /api/interviews/[id] enforces, covering BOTH demand assignment and creator ownership)
 * with the RESULT rule. A demand-level flag could only express ownership, which would offer an
 * edit the API rejects whenever a Recruiter opens an interview a colleague scheduled.
 * `undefined` can_manage (endpoint did not report it) is treated as allowed, matching the rest
 * of the app's per-row flag convention.
 */
export function FullCalendarInterviewView({ demandId }: FullCalendarInterviewViewProps) {
  const { transition: transitionStatusOptions } = useInterviewStatusOptions();
  const [selected, setSelected] = useState<DemandInterview | null>(null);
  /** Id of the interview whose status was switched to Completed and is awaiting a Result. */
  const [pendingCompletion, setPendingCompletion] = useState<string | null>(null);
  const interviewsQuery = useCalendarInterviewsQuery({ demand_id: demandId });
  const updateMutation = useUpdateInterviewMutation();

  const events = useMemo(
    () =>
      (interviewsQuery.data ?? []).map((iv) => {
        const sourcePart = iv.source ? ` (${formatSourceLabel(iv.source)})` : '';
        return {
          id: iv.id,
          title: `${iv.candidate_name || 'Candidate'}${sourcePart} — ${iv.round_name || 'Interview'}`,
          start: iv.scheduled_time ? `${iv.scheduled_date}T${iv.scheduled_time}` : iv.scheduled_date,
          color: STATUS_COLOR[iv.status || 'Scheduled'] || '#3b82f6',
          extendedProps: { interview: iv },
        };
      }),
    [interviewsQuery.data]
  );

  const handleEventClick = (arg: EventClickArg) => {
    setSelected(arg.event.extendedProps.interview as DemandInterview);
  };

  const renderEventContent = (arg: EventContentArg) => (
    <div
      className="truncate rounded px-1.5 py-0.5 text-[0.7rem] font-semibold text-white"
      style={{ backgroundColor: arg.backgroundColor || arg.event.backgroundColor || '#3b82f6' }}
    >
      {arg.event.title}
    </div>
  );

  return (
    <div className="rounded-xl border border-[color:var(--card-border)] bg-white p-4 shadow-[var(--card-shadow)]">
      <div className="fc-costaff-wrapper">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={events}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          height="auto"
          editable={false}
          selectable={false}
          dayMaxEvents={3}
        />
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-[1rem] font-bold text-[#0f172a]">{selected.candidate_name || selected.round_name}</div>
                <div className="text-[0.78rem] text-[#64748b]">{selected.round_name} · {selected.scheduled_date ? formatScheduledDate(selected.scheduled_date) : ''} {selected.scheduled_time ? formatScheduledTime(selected.scheduled_time) : ''}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#94a3b8] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex flex-col gap-2 text-[0.82rem] text-[#334155]">
              <div><strong>Demand:</strong> {selected.demand_request_id || '—'}</div>
              {selected.source && <div><strong>Source:</strong> {formatSourceLabel(selected.source)}</div>}
              {selected.created_by_name && <div><strong>Created By:</strong> {selected.created_by_name}</div>}
              {selected.meeting_link && (
                <a href={selected.meeting_link} target="_blank" rel="noreferrer" className="font-semibold text-[#2563eb] underline">Meeting link</a>
              )}
              <div><strong>Mode:</strong> {selected.mode || '—'}</div>
            </div>

            {/* Per-interview permission (role + status rule) from the shared helper — a
                Completed interview is locked regardless of result; every other status stays
                editable. Evaluated for THIS round only. */}
            {getInterviewRowActions(
              { status: selected.status },
              { canManage: selected.can_manage !== false, blockedReason: selected.manage_blocked_reason }
            ).canEdit ? (
              <div className="mt-4 flex flex-col gap-3">
                <FormSelect
                  label="Status"
                  options={transitionStatusOptions}
                  value={selected.status || 'Scheduled'}
                  onChange={(v) => {
                    // Completed needs a Result, so it doesn't save on its own — it reveals
                    // the required picker and both are saved together once one is chosen.
                    // Every other status (including a re-schedule back to Scheduled) saves
                    // straight away and clears the result.
                    if (v === INTERVIEW_COMPLETED_STATUS) {
                      setPendingCompletion(selected.id);
                      return;
                    }
                    setPendingCompletion(null);
                    setSelected((prev) => (prev ? { ...prev, status: v, result: '' } : prev));
                    updateMutation.mutate({ interviewId: selected.id, payload: { status: v, result: '' } });
                  }}
                  small
                />
                {pendingCompletion === selected.id ? (
                  <FormSelect
                    label="Result"
                    required
                    placeholder="Select result…"
                    options={RESULT_OPTIONS}
                    value=""
                    onChange={(v) => {
                      if (!v) return;
                      setPendingCompletion(null);
                      setSelected((prev) => (prev ? { ...prev, status: INTERVIEW_COMPLETED_STATUS, result: v } : prev));
                      updateMutation.mutate({ interviewId: selected.id, payload: { status: INTERVIEW_COMPLETED_STATUS, result: v } });
                    }}
                    small
                  />
                ) : (
                  selected.result && (
                    <div className="text-[0.78rem] text-[#475569]">
                      <span className="font-semibold">Result:</span> {selected.result}
                    </div>
                  )
                )}
                <div>
                  <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Feedback</label>
                  <Textarea
                    rows={3}
                    defaultValue={selected.feedback || ''}
                    onBlur={(e) => updateMutation.mutate({ interviewId: selected.id, payload: { feedback: e.target.value } })}
                    className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.8rem] shadow-none"
                  />
                </div>
              </div>
            ) : (
              /* No disabled/greyed-out controls — when the result rule or the role check
                 blocks editing, the outcome is shown read-only with the reason. */
              <div className="mt-3 flex flex-col gap-2">
                {selected.result && (
                  <div className="text-[0.78rem] text-[#475569]">
                    <span className="font-semibold">Result:</span> {selected.result}
                  </div>
                )}
                <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.76rem] text-[#92400e]">
                  {getInterviewRowActions(
                    { status: selected.status },
                    { canManage: selected.can_manage !== false, blockedReason: selected.manage_blocked_reason }
                  ).editBlockedReason || 'This interview cannot be edited.'}
                </div>
                {selected.feedback && <div className="rounded-md bg-[#f8fafc] p-2 text-[0.8rem] text-[#475569]">{selected.feedback}</div>}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
