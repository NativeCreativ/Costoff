'use client';

import { FullCalendarInterviewView } from './FullCalendarInterviewView';

/**
 * /interview-calendar — global FullCalendar across all demands.
 *
 * Which interviews are visible is decided entirely by GET /api/calendar/interviews
 * (buildInterviewReadScope), and whether the viewer may EDIT one is decided per event by the
 * server's `can_manage` flag. This component therefore takes no role input at all — it cannot
 * accidentally widen or narrow either rule.
 */
export function GlobalInterviewCalendarView() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[1.05rem] font-bold text-[#0f172a]">Interview Calendar</h2>
        <p className="text-[0.82rem] text-[#64748b]">View-only calendar of all scheduled interviews. Open an interview to see its details; Status, Result and Feedback are editable only for interviews you are allowed to manage.</p>
      </div>
      <FullCalendarInterviewView />
    </div>
  );
}
