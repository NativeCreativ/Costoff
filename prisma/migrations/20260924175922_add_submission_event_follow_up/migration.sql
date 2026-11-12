-- Adds an optional "next follow-up" date to submission_events, so a call_log
-- entry (Log Call) can record when the recruiter should call the candidate
-- again. Nullable — most events (notes, status changes, etc.) never set it.
ALTER TABLE "submission_events" ADD COLUMN "follow_up_at" DATE;
