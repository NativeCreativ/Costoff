'use client';

import { FileText, MessageSquare, Phone, CalendarClock, ClipboardCheck, FileUp, ShieldCheck, StickyNote } from 'lucide-react';
import type { SubmissionEvent } from '@/components/types';
import { submissionStatusLabel } from './statusStyles';
import { formatDateTime, formatScheduledDate } from '@/lib/utils';
import { USER_ROLE_ABBR } from '@/constants/options';

const EVENT_ICONS: Record<string, any> = {
  status_change: ClipboardCheck,
  note: StickyNote,
  call_log: Phone,
  interview_scheduled: CalendarClock,
  interview_feedback: MessageSquare,
  document_uploaded: FileUp,
  bgv_update: ShieldCheck,
  remark: FileText,
};

const EVENT_LABELS: Record<string, string> = {
  status_change: 'Status Change',
  note: 'Note',
  call_log: 'Call Log',
  interview_scheduled: 'Interview Scheduled',
  interview_feedback: 'Interview Feedback',
  document_uploaded: 'Document',
  bgv_update: 'BGV Update',
  remark: 'Remark',
};

/**
 * The interview round an event refers to. Prefers the round_name captured on the event
 * itself; falls back to looking the interview up by its id for events recorded before that
 * was stored. Returns null when neither is available.
 */
function resolveEventRoundName(
  event: SubmissionEvent,
  interviewsById: Record<string, { round_name?: string | null }>
): string | null {
  const meta = event.metadata as Record<string, unknown> | null | undefined;
  const fromMeta = meta?.round_name;
  if (typeof fromMeta === 'string' && fromMeta.trim() !== '') return fromMeta.trim();
  const interviewId = meta?.interview_id;
  if (typeof interviewId === 'string') {
    const name = interviewsById[interviewId]?.round_name;
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return null;
}

interface CandidateEventTimelineProps {
  events: SubmissionEvent[];
  /** The candidate's interviews, used to name the round for interview events. Events
   *  written before the round was recorded in their metadata fall back to this map, keyed
   *  by the `interview_id` in their metadata, so older history still shows the round. */
  interviewsById?: Record<string, { round_name?: string | null }>;
}

export function CandidateEventTimeline({ events, interviewsById = {} }: CandidateEventTimelineProps) {
  if (events.length === 0) {
    return <div className="py-6 text-center text-[0.83rem] text-[#94a3b8]">No activity recorded yet.</div>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((event) => {
        const Icon = EVENT_ICONS[event.event_type] || FileText;
        const isInterviewEvent = event.event_type === 'interview_scheduled' || event.event_type === 'interview_feedback';
        const roundName = isInterviewEvent ? resolveEventRoundName(event, interviewsById) : null;
        return (
          <li key={event.id} className="flex items-start gap-3 border-b border-[#f1f5f9] pb-3 last:border-none last:pb-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[0.8rem] font-semibold text-[#0f172a]">
                  {/* Interview events name their round inline ("Interview Feedback — HR")
                      so an outcome is never ambiguous about which round it describes. */}
                  {EVENT_LABELS[event.event_type] || event.event_type}
                  {roundName && <span className="ml-1 font-normal text-[#64748b]">— {roundName}</span>}

                  {event.event_type === 'status_change' && event.to_status && (
                    <span className="ml-1 font-normal text-[#64748b]">
                      {event.from_status
                        ? `${submissionStatusLabel(event.from_status)} → ${submissionStatusLabel(event.to_status)}`
                        : `→ ${submissionStatusLabel(event.to_status)}`}
                    </span>
                  )}
                </div>

                <div className="shrink-0 text-[0.65rem] text-[#94a3b8]">
                  {formatDateTime(event.created_at)}
                </div>
              </div>

              {event.content && (
                <div className="mt-0.5 whitespace-pre-wrap text-[0.8rem] text-[#475569]">
                  {event.content}
                </div>
              )}

              {event.follow_up_at && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#fffbeb] px-2 py-0.5 text-[0.74rem] font-semibold text-[#b45309]">
                  <CalendarClock className="h-3 w-3" />
                  Follow up on {formatScheduledDate(event.follow_up_at)}
                </div>
              )}

              {event.attachment_url && (
                <a
                  href={event.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-block text-[0.76rem] font-semibold text-[#2563eb] underline"
                >
                  View attachment
                </a>
              )}

              <div className="mt-1 text-[0.7rem] text-[#94a3b8]">
                {event.profiles?.full_name ? (
                  <>
                    <span className="text-[0.7rem] text-[#64748b]">
                      {event.profiles.full_name}{" "}
                    </span>

                    {event.profiles.role && (
                      <span className="text-[0.65rem] text-black">
                        ({USER_ROLE_ABBR[event.profiles.role] ?? event.profiles.role})
                      </span>
                    )}
                  </>
                ) : (
                  <span>System</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
