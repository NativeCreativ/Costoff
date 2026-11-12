'use client';

import { GlobalInterviewCalendarView } from '@/components/demandFulfillment/GlobalInterviewCalendarView';

/**
 * /interview-calendar — global, role-filtered calendar across all demands.
 *
 * No role check here on purpose. This page only DECIDES WHICH INTERVIEWS ARE VISIBLE, and that
 * is the calendar API's job (GET /api/calendar/interviews applies buildInterviewReadScope).
 * Whether the viewer may edit a given interview is a per-ROW decision — it depends on demand
 * assignment and on who scheduled it, which only the server can resolve — so each event now
 * carries `can_manage` from GET /api/calendar/interviews (computed with the same
 * canEditInterview rule PATCH /api/interviews/[id] enforces) and the detail modal gates on that.
 *
 * The previous page-level check was a hardcoded role OR-chain that included `spoc` (read-only
 * for interviews everywhere else) and, for AM/Recruiter, implied they could edit ANY interview
 * regardless of ownership.
 */
export default function InterviewCalendarPage() {
  return <GlobalInterviewCalendarView />;
}
