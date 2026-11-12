-- Demand lifecycle: new demands start Open, extra demand-detail fields,
-- sourcing Active/Backup, shortlist-reject, assignment changelog, Panel No-Show.
-- Existing demand rows keep their current status.

ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'Open';
ALTER TABLE "demands" ADD COLUMN "engagement_type" VARCHAR(20);
ALTER TABLE "demands" ADD COLUMN "client_demand_id" VARCHAR(100);
ALTER TABLE "demands" ADD COLUMN "intermediary_partner" VARCHAR(255);
ALTER TABLE "demands" ADD COLUMN "customer_jd" TEXT;
ALTER TABLE "demands" ADD COLUMN "client_spoc_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "submissions" ADD COLUMN "sourcing_type" VARCHAR(20) DEFAULT 'active';
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_sourcing_type_check"
  CHECK ("sourcing_type" IS NULL OR "sourcing_type" IN ('active', 'backup'));

ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_current_status_check";
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_current_status_check" CHECK ("current_status" IN (
  'sourced', 'submitted_to_spoc', 'shortlisted_internal', 'sent_to_customer',
  'customer_shortlisted', 'interview_scheduled', 'interviewed', 'selected',
  'shortlist_reject', 'rejected', 'offer_released', 'offer_accepted', 'onboarding',
  'bgv_pending', 'bgv_verified', 'joined', 'dropped', 'backed_out'
));

CREATE TABLE "demand_assignment_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "demand_id" UUID NOT NULL,
  "category" VARCHAR(30) NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "subject_id" UUID,
  "subject_label" VARCHAR(255),
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "demand_assignment_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demand_assignment_events_demand_id_created_at_idx" ON "demand_assignment_events" ("demand_id", "created_at");
ALTER TABLE "demand_assignment_events"
  ADD CONSTRAINT "demand_assignment_events_demand_id_fkey"
  FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

INSERT INTO "interview_statuses" ("name", "sort_order", "is_transition", "requires_result")
VALUES ('Panel No-Show', 5, true, false)
ON CONFLICT ("name") DO NOTHING;
