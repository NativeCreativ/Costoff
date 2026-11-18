-- App review batches 3-4 (Nov 2026): Call Log "Demand Match" + skill group + edits, Sourcing
-- submit / approve / reject review, draft (saved, not yet submitted) demands.

-- Call Log: "fit" is renamed "demand_match"; a Demand Match no longer adds the candidate to
-- Sourcing by itself — the caller completes the candidate form first (submission_id set then).
ALTER TABLE "demand_call_logs" DROP CONSTRAINT IF EXISTS "demand_call_logs_outcome_check";
ALTER TABLE "demand_call_logs" DROP CONSTRAINT IF EXISTS "demand_call_logs_reason_check";
ALTER TABLE "demand_call_logs" ALTER COLUMN "outcome" TYPE VARCHAR(20);
UPDATE "demand_call_logs" SET "outcome" = 'demand_match' WHERE "outcome" = 'fit';
ALTER TABLE "demand_call_logs" ADD CONSTRAINT "demand_call_logs_outcome_check" CHECK ("outcome" IN ('demand_match', 'not_fit'));
ALTER TABLE "demand_call_logs" ADD CONSTRAINT "demand_call_logs_reason_check" CHECK ("outcome" = 'demand_match' OR "fail_reason" IS NOT NULL);
ALTER TABLE "demand_call_logs" ADD COLUMN "skill_group_id" UUID;
ALTER TABLE "demand_call_logs" ADD CONSTRAINT "demand_call_logs_skill_group_id_fkey" FOREIGN KEY ("skill_group_id") REFERENCES "skill_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "demand_call_logs" ADD COLUMN "updated_by" UUID;
ALTER TABLE "demand_call_logs" ADD CONSTRAINT "demand_call_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "demand_call_logs" ADD COLUMN "updated_at" TIMESTAMPTZ(6);

-- Sourcing review. A TA saves a profile (status sourced) and submits it (submitted_to_spoc);
-- the AM / SPOC approves (-> shortlisted_internal) or rejects. A rejected profile goes back to
-- sourced with review_state = 'rejected' so the TA can fix it and submit again.
ALTER TABLE "submissions" ADD COLUMN "review_state" VARCHAR(20);
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_review_state_check" CHECK ("review_state" IS NULL OR "review_state" IN ('rejected'));
ALTER TABLE "submissions" ADD COLUMN "review_remark" TEXT;
ALTER TABLE "submissions" ADD COLUMN "reviewed_by" UUID;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "submissions" ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);
ALTER TABLE "submissions" ADD COLUMN "submitted_for_review_at" TIMESTAMPTZ(6);

-- Draft demands: saved by their creator, not yet published to the team.
ALTER TABLE "demands" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "demands_is_draft_idx" ON "demands"("is_draft") WHERE "is_draft";

-- New notification types for the review flow.
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("type" IN ('demand_assigned', 'profile_submitted', 'profile_reviewed'));
