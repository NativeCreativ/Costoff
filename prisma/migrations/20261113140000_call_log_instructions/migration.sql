-- Call Log (calls about a candidate for a demand, with a fitment result) and Instruction Log
-- (customer instructions recorded by AM / SPOC for the TAs). New tables only.

CREATE TABLE "demand_call_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "demand_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "outcome" VARCHAR(10) NOT NULL,
  "fail_reason" VARCHAR(100),
  "notes" TEXT,
  "submission_id" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "demand_call_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "demand_call_logs_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "demand_call_logs_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "demand_call_logs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "demand_call_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "demand_call_logs_outcome_check" CHECK ("outcome" IN ('fit', 'not_fit')),
  CONSTRAINT "demand_call_logs_reason_check" CHECK ("outcome" = 'fit' OR "fail_reason" IS NOT NULL)
);
CREATE INDEX "demand_call_logs_demand_id_created_at_idx" ON "demand_call_logs"("demand_id", "created_at");
CREATE INDEX "demand_call_logs_created_by_idx" ON "demand_call_logs"("created_by");
CREATE INDEX "demand_call_logs_candidate_id_idx" ON "demand_call_logs"("candidate_id");

CREATE TABLE "demand_instructions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "demand_id" UUID NOT NULL,
  "source" VARCHAR(20) NOT NULL DEFAULT 'meeting',
  "instruction_date" DATE NOT NULL,
  "content" TEXT NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "demand_instructions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "demand_instructions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "demand_instructions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "demand_instructions_demand_id_instruction_date_idx" ON "demand_instructions"("demand_id", "instruction_date");
