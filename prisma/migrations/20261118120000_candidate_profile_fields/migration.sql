-- App review batch 2 (Nov 2026): candidate profile fields, "Other Details" on candidate /
-- demand / client, new candidate sources and notice periods.

ALTER TABLE "candidates" ADD COLUMN "alternate_email" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "relevant_experience" VARCHAR(100);
-- PAN: AES-256-GCM ciphertext (src/lib/candidates/panCrypto.ts) + last 4 characters for display.
ALTER TABLE "candidates" ADD COLUMN "pan_encrypted" TEXT;
ALTER TABLE "candidates" ADD COLUMN "pan_last4" VARCHAR(4);
ALTER TABLE "candidates" ADD COLUMN "date_of_birth" DATE;
-- RTR (Right to Represent / acknowledgment): a tick, an optional note and an optional file.
ALTER TABLE "candidates" ADD COLUMN "rtr_acknowledged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN "rtr_note" VARCHAR(500);
ALTER TABLE "candidates" ADD COLUMN "rtr_file_url" VARCHAR(500);
ALTER TABLE "candidates" ADD COLUMN "rtr_file_name" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "photo_url" VARCHAR(500);
ALTER TABLE "candidates" ADD COLUMN "resume_url" VARCHAR(500);
ALTER TABLE "candidates" ADD COLUMN "resume_file_name" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "employee_id" VARCHAR(100);
ALTER TABLE "candidates" ADD COLUMN "core_specialization" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "duration_in_role" VARCHAR(100);
ALTER TABLE "candidates" ADD COLUMN "reason_for_change" TEXT;
ALTER TABLE "candidates" ADD COLUMN "last_working_day" DATE;
ALTER TABLE "candidates" ADD COLUMN "other_details" TEXT;

ALTER TABLE "demands" ADD COLUMN "other_details" TEXT;
ALTER TABLE "companies" ADD COLUMN "other_details" TEXT;

-- Notice period list: "15 Days" becomes "0-15 Days".
UPDATE "candidates" SET "availability" = '0-15 Days' WHERE "availability" = '15 Days';

-- New sources: HeadHunt, Database.
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_source_check";
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_source_check"
CHECK (source IN ('naukri','linkedin','indeed','direct','referral','headhunt','database','others',''));
