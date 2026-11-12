-- Demand Fulfillment workflow: assignments, candidate pipeline (extends submissions),
-- pipeline event history, interview config + extra interview fields, onboarding
-- extensions, and global super-admin settings for this module.

-- ── demand_assignments ──────────────────────────────────────────────────────
-- Explicit, auditable record of who is assigned to a demand and in what capacity.
-- Existing demands.contact_profile_id (AM/SPOC) and demand_ta_allocations (recruiters)
-- remain the source of truth for "who can see/act on this demand" (unchanged, to avoid
-- touching existing visibility/permission code); this table adds the assignment
-- *history* + remark the spec requires, and is written alongside them.
CREATE TABLE "demand_assignments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "demand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_in_demand" VARCHAR(20) NOT NULL, -- account_manager | spoc | recruiter
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,

    CONSTRAINT "demand_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "demand_assignments_role_check" CHECK ("role_in_demand" IN ('account_manager', 'spoc', 'recruiter')),
    CONSTRAINT "demand_assignments_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE,
    CONSTRAINT "demand_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "demand_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "profiles"("id")
);

CREATE INDEX "demand_assignments_demand_id_idx" ON "demand_assignments" ("demand_id");
CREATE INDEX "demand_assignments_user_id_idx" ON "demand_assignments" ("user_id");

-- ── demand_status_events ────────────────────────────────────────────────────
-- Append-only audit trail of demand-level status transitions (Assign -> Sourcing ->
-- ... -> Closure, plus On Hold / Cancelled / Reopen). Every transition requires a remark.
CREATE TABLE "demand_status_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "demand_id" UUID NOT NULL,
    "from_status" VARCHAR(50),
    "to_status" VARCHAR(50) NOT NULL,
    "remark" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_status_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "demand_status_events_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE,
    CONSTRAINT "demand_status_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id")
);

CREATE INDEX "demand_status_events_demand_id_created_at_idx" ON "demand_status_events" ("demand_id", "created_at");

-- ── submissions: extend into the full candidate-in-demand pipeline pivot ───
-- `submissions` already is "one candidate attached to one demand" (the
-- demand_candidates concept from the spec) — extend it in place instead of
-- creating a parallel table.
ALTER TABLE "submissions"
  ADD COLUMN "current_status" VARCHAR(30) NOT NULL DEFAULT 'sourced',
  ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'internal_db',
  ADD COLUMN "position_slot" INTEGER,
  ADD COLUMN "added_by" UUID,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "final_result" VARCHAR(20);

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_current_status_check" CHECK ("current_status" IN (
    'sourced', 'submitted_to_spoc', 'shortlisted_internal', 'sent_to_customer',
    'customer_shortlisted', 'interview_scheduled', 'interviewed', 'selected',
    'rejected', 'offer_released', 'offer_accepted', 'onboarding', 'bgv_pending',
    'bgv_verified', 'joined', 'dropped', 'backed_out'
  )),
  ADD CONSTRAINT "submissions_source_check" CHECK ("source" IN (
    'internal_db', 'naukri', 'indeed', 'linkedin', 'referral', 'other'
  )),
  ADD CONSTRAINT "submissions_final_result_check" CHECK ("final_result" IS NULL OR "final_result" IN (
    'joined', 'rejected', 'dropped', 'backed_out'
  )),
  ADD CONSTRAINT "submissions_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "profiles"("id");

-- Backfill: map the legacy free-text `stage` values onto the new pipeline enum
-- so existing rows keep a sane status instead of silently defaulting to 'sourced'.
UPDATE "submissions" SET "current_status" = CASE "stage"
  WHEN 'phone_call_done' THEN 'sourced'
  WHEN 'submitted_for_am_review' THEN 'submitted_to_spoc'
  WHEN 'submitted_to_client' THEN 'sent_to_customer'
  WHEN 'shortlisted_by_client' THEN 'customer_shortlisted'
  WHEN 'l1_interview' THEN 'interview_scheduled'
  WHEN 'l2_interview' THEN 'interview_scheduled'
  WHEN 'selected' THEN 'selected'
  WHEN 'offer_released' THEN 'offer_released'
  WHEN 'joined' THEN 'joined'
  WHEN 'rejected' THEN 'rejected'
  ELSE 'sourced'
END
WHERE "stage" IS NOT NULL;

UPDATE "submissions" SET "is_active" = false, "final_result" = 'rejected' WHERE "current_status" = 'rejected';
UPDATE "submissions" SET "is_active" = false, "final_result" = 'joined' WHERE "current_status" = 'joined';

CREATE INDEX "submissions_demand_id_current_status_idx" ON "submissions" ("demand_id", "current_status");

-- ── submission_events (append-only pipeline history) ───────────────────────
-- Every status change / note / call log / interview / document event for a
-- candidate-in-demand row (submissions.id). Never updated or deleted.
CREATE TABLE "submission_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "submission_id" UUID NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30),
    "content" TEXT,
    "attachment_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "submission_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "submission_events_event_type_check" CHECK ("event_type" IN (
      'status_change', 'note', 'call_log', 'email_log', 'whatsapp_log',
      'interview_scheduled', 'interview_feedback', 'document_uploaded',
      'bgv_update', 'remark'
    )),
    CONSTRAINT "submission_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE,
    CONSTRAINT "submission_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id")
);

CREATE INDEX "submission_events_submission_id_created_at_idx" ON "submission_events" ("submission_id", "created_at");

-- ── demand_interview_config ─────────────────────────────────────────────────
-- Per-demand override of interview rounds. Absence of a row means "fall back
-- to global config (super_admin_settings.interview_rounds_default), else the
-- hardcoded ['Technical', 'HR'] default" — resolved in application code.
CREATE TABLE "demand_interview_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "demand_id" UUID NOT NULL,
    "rounds" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_interview_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "demand_interview_config_demand_id_key" UNIQUE ("demand_id"),
    CONSTRAINT "demand_interview_config_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE,
    CONSTRAINT "demand_interview_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id")
);

-- ── interviews: extend to carry round + config + remark fields ────────────
ALTER TABLE "interviews"
  ADD COLUMN "round_order" INTEGER,
  ADD COLUMN "duration_minutes" INTEGER,
  ADD COLUMN "interviewer_email" VARCHAR(255),
  ADD COLUMN "meeting_link" TEXT,
  ADD COLUMN "result" VARCHAR(20),
  ADD COLUMN "remark" TEXT,
  ADD COLUMN "created_by" UUID;

ALTER TABLE "interviews"
  ADD CONSTRAINT "interviews_result_check" CHECK ("result" IS NULL OR "result" IN ('pass', 'fail', 'on_hold')),
  ADD CONSTRAINT "interviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");

-- `level` (L1/L2/.../Final) already plays the role of round_name; no rename to
-- avoid breaking existing interview UI/queries.
CREATE INDEX "interviews_submission_id_idx" ON "interviews" ("submission_id");

-- ── onboardings: extend with documents/BGV/closure tracking ────────────────
ALTER TABLE "onboardings"
  ADD COLUMN "documents_status" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "bgv_remark" TEXT,
  ADD COLUMN "offer_released_at" TIMESTAMPTZ(6),
  ADD COLUMN "offer_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "joined_at" TIMESTAMPTZ(6),
  -- Plain column (not GENERATED: TIMESTAMPTZ + INTERVAL arithmetic is not an
  -- immutable expression, since the result depends on the session timezone),
  -- kept in sync by the trigger below.
  ADD COLUMN "closure_due_at" TIMESTAMPTZ(6),
  ADD COLUMN "closure_feedback" TEXT,
  ADD COLUMN "closed_at" TIMESTAMPTZ(6),
  ADD COLUMN "remark" TEXT,
  ADD COLUMN "submission_id" UUID;

ALTER TABLE "onboardings"
  ADD CONSTRAINT "onboardings_submission_id_key" UNIQUE ("submission_id"),
  ADD CONSTRAINT "onboardings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION "set_onboarding_closure_due_at"() RETURNS TRIGGER AS $$
BEGIN
  NEW."closure_due_at" := NEW."joined_at" + INTERVAL '90 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "onboardings_set_closure_due_at"
  BEFORE INSERT OR UPDATE OF "joined_at" ON "onboardings"
  FOR EACH ROW EXECUTE FUNCTION "set_onboarding_closure_due_at"();

-- Backfill joined_at from the existing actual_joining_date column, and existing
-- bgv_status ('in_progress' default) is left as-is; the module treats
-- 'not_required' as an additional allowed value going forward.
UPDATE "onboardings" SET "joined_at" = "actual_joining_date"::timestamptz WHERE "actual_joining_date" IS NOT NULL;

CREATE INDEX "onboardings_closure_due_at_idx" ON "onboardings" ("closure_due_at") WHERE "closed_at" IS NULL;

-- ── super_admin_settings (singleton row, keyed) ─────────────────────────────
CREATE TABLE "super_admin_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" VARCHAR(50) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "super_admin_settings_key_key" UNIQUE ("key"),
    CONSTRAINT "super_admin_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id")
);

INSERT INTO "super_admin_settings" ("key", "value") VALUES
  ('resume_cap_per_position', '3'),
  ('interview_rounds_default', '[{"name": "Technical", "order": 1, "mandatory": true}, {"name": "HR", "order": 2, "mandatory": true}]'),
  ('onboarding_document_checklist', '[{"name": "Aadhaar", "required": true}, {"name": "PAN Card", "required": true}, {"name": "Latest Payslip", "required": true}, {"name": "Relieving Letter", "required": false}, {"name": "Education Certificates", "required": true}]'),
  ('bgv_checklist', '[{"name": "Identity Verification", "required": true}, {"name": "Address Verification", "required": true}, {"name": "Employment Verification", "required": true}, {"name": "Education Verification", "required": true}, {"name": "Criminal Record Check", "required": false}]');
