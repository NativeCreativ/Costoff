-- Candidate Step 1: add columns for fields the form requires but the table doesn't have yet.
ALTER TABLE "candidates" ADD COLUMN "specialization" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "total_experience" VARCHAR(100);
ALTER TABLE "candidates" ADD COLUMN "work_mode" VARCHAR(20);
ALTER TABLE "candidates" ADD COLUMN "linked_url" VARCHAR(500);
ALTER TABLE "candidates" ADD COLUMN "updated_by" UUID;

ALTER TABLE "candidates" ADD CONSTRAINT "candidates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
