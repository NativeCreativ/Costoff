-- Company interview rounds gain an Active/Inactive flag (Clients Master → Edit Client), matching
-- the target "Interview Rounds" table layout. An inactive round is hidden from new demands but
-- stays on any demand that already inherited it (and on existing interviews/pipelines, which
-- never read this table at all).
--
-- Reversible: every existing round defaults to TRUE (active) — nothing changes for a company that
-- already has rounds, and dropping the column again is a no-op for every other part of the app
-- (demand_interview_rounds / interviews never reference it).
ALTER TABLE "company_interview_rounds" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
