-- App review batch 1 (Nov 2026). Adds only.

-- Demand: free-text shift timings and general comments.
ALTER TABLE "demands" ADD COLUMN "shift_timings" VARCHAR(255);
ALTER TABLE "demands" ADD COLUMN "comments" TEXT;

-- Task Log: who assigned the task (free text) and hours spent.
ALTER TABLE "task_logs" ADD COLUMN "assigned_by" VARCHAR(200);
ALTER TABLE "task_logs" ADD COLUMN "hours" DECIMAL(6,2);
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_hours_check" CHECK ("hours" IS NULL OR ("hours" >= 0 AND "hours" <= 9999));
