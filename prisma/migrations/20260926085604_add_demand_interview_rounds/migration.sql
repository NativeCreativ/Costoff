-- Step 2 (Interview & Schedules): converts interview rounds from a manually-stored name/text
-- reference into a real, ID-bearing relation, per the requirement that the selected Interview
-- Round must reference the configured Round's ID. demand_interview_config.rounds (JSON) stays
-- the editable source of truth for the Demand Settings round editor; this table is a
-- materialized, ID-bearing projection of it (or of the global/hardcoded fallback when a demand
-- has no override yet), kept in sync by the application (see resolveInterviewRounds() /
-- syncMaterializedRounds()). Additive only — no destructive changes.

CREATE TABLE "demand_interview_rounds" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "demand_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "round_order" INTEGER NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "demand_interview_rounds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "demand_interview_rounds"
  ADD CONSTRAINT "demand_interview_rounds_demand_id_fkey"
  FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "demand_interview_rounds_demand_id_round_order_key"
  ON "demand_interview_rounds" ("demand_id", "round_order");

CREATE INDEX "demand_interview_rounds_demand_id_idx" ON "demand_interview_rounds" ("demand_id");

ALTER TABLE "interviews"
  ADD COLUMN "round_id" UUID;

ALTER TABLE "interviews"
  ADD CONSTRAINT "interviews_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "demand_interview_rounds"("id") ON UPDATE NO ACTION;

CREATE INDEX "interviews_round_id_idx" ON "interviews" ("round_id");
