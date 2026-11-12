import { z } from 'zod';

// Mirrors InterviewFormState (all fields always present as strings, some allowed empty) while
// reusing the shared demand-fulfillment interview validation rule (end-time-after-start-time)
// instead of maintaining a third, divergent set of business rules for this surface.
// `round_id` holds the configured round's real id (never free-typed — the form sources its
// options from that demand's materialized rounds; the backend re-validates it against them).
// `demand_id`/`candidate_id` are real ids from DB-backed searchable selects, not free text.
export const interviewSchema = z.object({
  demand_id: z.string().uuid('Requirement is required'),
  candidate_id: z.string().uuid('Candidate is required'),
  // Round and Mode are one field ("Interview Round and Mode") — the option's id is this demand's
  // own round id; its mode travels with it automatically as a plain-text snapshot, resolved
  // server-side from that same round. There is no separate `mode` field to validate here.
  round_id: z.string().uuid('Interview round is required'),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  // Both Start Time and End Time are REQUIRED — the backend also enforces this.
  // Duration is auto-calculated; end-after-start is enforced by the refine below.
  scheduled_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  // Auto-calculated from scheduled_time/end_time — never user-editable, so no min/format rule.
  duration_minutes: z.number().int().positive().nullable(),
  link_status: z.string(),
  meeting_link: z.string().refine((v) => v === '' || z.string().url().safeParse(v).success, 'Invalid URL'),
  status: z.string(),
  // Edit only, and only for a Completed interview — the refine below enforces both.
  result: z.string().optional(),
}).refine(
  (v) => v.end_time > v.scheduled_time,
  { message: 'End time must be after the start time', path: ['end_time'] }
).refine(
  (v) => v.status !== 'Completed' || !!v.result,
  { message: 'Select a Result when marking an interview Completed', path: ['result'] }
).refine(
  (v) => !v.result || v.status === 'Completed',
  { message: 'A Result can only be recorded when the interview status is Completed', path: ['result'] }
);

export type InterviewFormValues = z.infer<typeof interviewSchema>;
