-- Demand experience + certifications; candidate offer-in-hand and conversation log. Adds only.

ALTER TABLE "demands" ADD COLUMN "total_experience" VARCHAR(100);
ALTER TABLE "demands" ADD COLUMN "relevant_experience" VARCHAR(100);
-- [{ "name": "AWS Solutions Architect", "type": "Technical" }, ...]; type is Technical | Behavioral | Others.
ALTER TABLE "demands" ADD COLUMN "certifications" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Offer in hand (drives the "Urgent" badge with the notice period). holding_other_offer is a
-- legacy free-text column nothing reads; it is left as is.
ALTER TABLE "candidates" ADD COLUMN "offer_in_hand" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "candidates" ADD COLUMN "offer_company" VARCHAR(255);
ALTER TABLE "candidates" ADD COLUMN "offer_ctc" DECIMAL(10,2);
ALTER TABLE "candidates" ADD COLUMN "offer_doj" DATE;

-- Conversation log: one row per conversation with the candidate, entered by any user who works
-- on the candidate. demand_id is optional context ("which requirement was this about").
CREATE TABLE "candidate_conversations" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "candidate_id" UUID NOT NULL,
  "demand_id" UUID,
  "channel" VARCHAR(20) NOT NULL DEFAULT 'call',
  "content" TEXT NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "candidate_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "candidate_conversations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "candidate_conversations_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "candidate_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "candidate_conversations_candidate_id_created_at_idx" ON "candidate_conversations"("candidate_id", "created_at");
