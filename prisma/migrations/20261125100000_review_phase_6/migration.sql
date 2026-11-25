-- Review of 18 Nov 2026 (commit 540d16a "complete platform enhancements across review phases
-- 1-6"). That commit changed schema.prisma without a migration; this adds exactly those changes.
-- Additive only: nothing is dropped. Also folds in scripts/migrateNicheDualApproval.js (the
-- niche SPOC -> AM approval statuses), so no separate script has to be run.

-- Skill_Group -> Skill Category -> Skills.
CREATE TABLE IF NOT EXISTS "skill_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skill_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "skill_groups_name_key" ON "skill_groups"("name");
ALTER TABLE "skill_categories" ADD COLUMN IF NOT EXISTS "group_id" UUID;
CREATE INDEX IF NOT EXISTS "skill_categories_group_id_idx" ON "skill_categories"("group_id");
ALTER TABLE "skill_categories" DROP CONSTRAINT IF EXISTS "skill_categories_group_id_fkey";
ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "skill_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Client: max active submissions per position; Rate -> CTC formula (client and demand level).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "max_submissions_per_position" INTEGER DEFAULT 5;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "rate_conversion_formula" JSONB;
ALTER TABLE "demands" ADD COLUMN IF NOT EXISTS "rate_conversion_formula" JSONB;

-- Niche demands: SPOC then AM approval.
ALTER TABLE "demands" ADD COLUMN IF NOT EXISTS "is_niche" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_current_status_check";
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_current_status_check"
  CHECK (((current_status)::text = ANY (ARRAY[
    'sourced', 'submitted_to_spoc', 'submitted_to_am', 'shortlisted_internal', 'sent_to_customer',
    'customer_shortlisted', 'interview_scheduled', 'interviewed', 'selected',
    'shortlist_reject', 'rejected', 'offer_released', 'offer_accepted',
    'onboarding', 'bgv_pending', 'bgv_verified', 'joined', 'dropped', 'backed_out'
  ]::text[])));
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_review_state_check";
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_review_state_check"
  CHECK (("review_state" IS NULL) OR ("review_state" IN ('rejected', 'spoc_approved', 'am_approved')));

-- Interview management: medium, reason / custom reason, reject reason, comments, reschedule chain.
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "medium" VARCHAR(50);
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "reason" VARCHAR(100);
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "custom_reason" TEXT;
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "reject_reason" TEXT;
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "comments" TEXT;
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "parent_interview_id" UUID;
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "interviews" ALTER COLUMN "scheduled_date" DROP NOT NULL;
ALTER TABLE "interviews" DROP CONSTRAINT IF EXISTS "interviews_parent_interview_id_fkey";
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_parent_interview_id_fkey" FOREIGN KEY ("parent_interview_id") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Working days (Master Data).
CREATE TABLE IF NOT EXISTS "working_days_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "working_days" INTEGER NOT NULL DEFAULT 22,
    "holidays_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "working_days_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "working_days_configs_year_month_key" ON "working_days_configs"("year", "month");
