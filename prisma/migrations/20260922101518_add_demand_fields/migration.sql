-- AlterTable
ALTER TABLE "demands"
  ADD COLUMN "job_title" VARCHAR(255),
  ADD COLUMN "work_mode" VARCHAR(20),
  ADD COLUMN "company_name" VARCHAR(255),
  ADD COLUMN "company_email" VARCHAR(255),
  ADD COLUMN "updated_by" UUID;

-- Backfill job_title from the existing skill_description so existing rows aren't left blank
UPDATE "demands"
SET "job_title" = "skill_description"
WHERE "job_title" IS NULL;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
