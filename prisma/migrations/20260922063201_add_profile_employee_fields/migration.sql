-- AlterTable
ALTER TABLE "profiles"
  ADD COLUMN "first_name" VARCHAR(255),
  ADD COLUMN "last_name" VARCHAR(255),
  ADD COLUMN "employee_id" VARCHAR(50),
  ADD COLUMN "date_of_joining" DATE,
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Backfill first_name/last_name from the existing full_name column
UPDATE "profiles"
SET
  "first_name" = COALESCE(NULLIF(SPLIT_PART("full_name", ' ', 1), ''), "full_name"),
  "last_name" = NULLIF(TRIM(SUBSTRING("full_name" FROM POSITION(' ' IN "full_name") + 1)), '')
WHERE "first_name" IS NULL;

-- Backfill status from the existing is_active flag
UPDATE "profiles"
SET "status" = CASE WHEN "is_active" = false THEN 'INACTIVE' ELSE 'ACTIVE' END;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_employee_id_key" ON "profiles"("employee_id");
