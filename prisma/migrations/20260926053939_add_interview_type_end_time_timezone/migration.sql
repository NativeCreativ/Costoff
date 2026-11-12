-- Finishes a previously-incomplete migration. interview_type, end_time and time_zone
-- columns were already applied directly to the database (outside the migration
-- history — this migration's file was empty before), but interviewer_profile_id and
-- updated_by, needed for the Interview & Schedules refactor, were not:
--   - interviewer_profile_id: FK to profiles, making the interviewer a first-class
--     system user reference instead of only free-text interviewer_name/interviewer_email.
--   - updated_by: brings `interviews` in line with the created_by/updated_by audit
--     convention already used by candidates/demands elsewhere in this schema.
-- Both columns are nullable — no backfill required, no destructive change.

ALTER TABLE "interviews"
  ADD COLUMN "interviewer_profile_id" UUID,
  ADD COLUMN "updated_by" UUID;

ALTER TABLE "interviews"
  ADD CONSTRAINT "interviews_interviewer_profile_id_fkey"
  FOREIGN KEY ("interviewer_profile_id") REFERENCES "profiles"("id") ON UPDATE NO ACTION;

ALTER TABLE "interviews"
  ADD CONSTRAINT "interviews_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON UPDATE NO ACTION;

CREATE INDEX "interviews_interviewer_profile_id_idx" ON "interviews" ("interviewer_profile_id");
