-- Per-employee screen access: screens the Delivery Head switched off for this employee.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "blocked_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
