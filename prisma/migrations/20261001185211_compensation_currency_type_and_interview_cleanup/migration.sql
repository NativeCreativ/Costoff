-- Reconciles migration history with changes that were applied directly via
-- `prisma db push` (not through a tracked migration) earlier in development:
--   1. Demand compensation structure: drops budget_min/budget_max, adds
--      compensation_currency_id/compensation_type_id/compensation_min/compensation_max
--      plus the new compensation_currencies/compensation_types master tables.
--   2. Interview cleanup: drops interviewer_name/interviewer_email/interviewer_profile_id
--      (replaced by created_by — "who scheduled it" rather than a free-text/linked
--      interviewer field) and records interview_type/end_time, which were already
--      live in the database but never captured in a migration file.
--   3. Recreates v_demands_with_aging (a database view, not a Prisma-managed object)
--      with the new compensation columns/joins instead of budget_min/budget_max.
--
-- IMPORTANT — three partial/expression indexes are NOT representable in
-- schema.prisma's DSL (LOWER(TRIM(...)) / regexp_replace(...) expression indexes,
-- and a multi-column partial unique index): demand_assignments_one_active_owner_per_demand,
-- candidates_normalized_email_key, candidates_normalized_phone_key. Their *migrations*
-- (20260924170125, 20260923102559) are still correct and still create them on a fresh
-- deploy — but on THIS already-existing dev database, an earlier `db push` saw them as
-- unrepresented drift and silently dropped all three. They were restored directly against
-- this database (verified no duplicate rows existed first) rather than through a migration,
-- since redeclaring a CREATE INDEX with the same name here would fail on a fresh deploy
-- ("already exists"). Because these can never be declared in schema.prisma, every future
-- schema change on this project MUST go through `prisma migrate dev`/`deploy` — never
-- `db push` — or they will be silently dropped again.

-- v_demands_with_aging depends on demands.budget_min/budget_max, so it must be dropped
-- before those columns can be dropped below. Recreated with the final column set at the
-- end of this migration.
DROP VIEW IF EXISTS v_demands_with_aging;

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT "demands_spoc_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "interviews" DROP CONSTRAINT "interviews_interviewer_profile_id_fkey";

-- DropIndex
DROP INDEX "demands_spoc_profile_id_idx";

-- DropIndex
DROP INDEX "interviews_interviewer_profile_id_idx";

-- AlterTable
ALTER TABLE "demands" DROP COLUMN "budget_max",
DROP COLUMN "budget_min",
ADD COLUMN     "compensation_currency_id" UUID,
ADD COLUMN     "compensation_max" DECIMAL(14,2),
ADD COLUMN     "compensation_min" DECIMAL(14,2),
ADD COLUMN     "compensation_type_id" UUID;

-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "interviewer_email",
DROP COLUMN "interviewer_name",
DROP COLUMN "interviewer_profile_id",
ADD COLUMN     "end_time" TIME(6),
ADD COLUMN     "interview_type" VARCHAR(50);

-- CreateTable
CREATE TABLE "compensation_currencies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_currencies_code_key" ON "compensation_currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_types_name_key" ON "compensation_types"("name");

-- CreateIndex
CREATE INDEX "demands_compensation_currency_id_idx" ON "demands"("compensation_currency_id");

-- CreateIndex
CREATE INDEX "demands_compensation_type_id_idx" ON "demands"("compensation_type_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_spoc_profile_id_fkey" FOREIGN KEY ("spoc_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_compensation_currency_id_fkey" FOREIGN KEY ("compensation_currency_id") REFERENCES "compensation_currencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_compensation_type_id_fkey" FOREIGN KEY ("compensation_type_id") REFERENCES "compensation_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- NOTE: demand_assignments_one_active_owner_per_demand, candidates_normalized_email_key
-- and candidates_normalized_phone_key are NOT recreated here — they are already created
-- by their original migrations (20260924170125, 20260923102559) and replaying this
-- migration after those on a fresh database would hit "index already exists". They were
-- only missing from THIS dev database because an earlier `db push` dropped them (schema.prisma
-- can't express partial/expression indexes, so db push treats them as drift); that was
-- fixed by restoring them directly against this database, not through a migration.

-- Recreate v_demands_with_aging (dropped near the top of this migration) with the new
-- compensation columns/joins instead of budget_min/budget_max (a database view — not
-- tracked by Prisma's migration diff engine, so it must be captured here explicitly).
-- Mirrors prisma/views/public/v_demands_with_aging.sql.
CREATE VIEW v_demands_with_aging AS
SELECT
  d.id,
  d.request_id,
  d.role_category,
  d.client_name,
  d.skill_description,
  d.technology_stack,
  d.experience_level,
  d.locations,
  d.compensation_currency_id,
  d.compensation_type_id,
  d.compensation_min,
  d.compensation_max,
  d.num_positions,
  d.status,
  d.priority,
  d.created_by,
  d.opened_at,
  d.closed_at,
  d.created_at,
  d.updated_at,
  d.job_title,
  d.work_mode,
  d.company_name,
  d.company_email,
  d.updated_by,
  d.contact_profile_id,
  p.full_name AS am_name,
  cc.code AS compensation_currency_code,
  cc.symbol AS compensation_currency_symbol,
  cc.name AS compensation_currency_name,
  ct.name AS compensation_type_name,
  COALESCE(ta.recruiter_ids, ARRAY[]::uuid[]) AS recruiter_ids,
  COALESCE(ta.recruiter_names, (ARRAY[]::text[])::character varying[]) AS recruiter_names,
  GREATEST(0, (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)))::integer) AS days_open,
  (
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > (30)::numeric)
    AND ((d.status)::text <> 'Closure'::text)
  ) AS is_red_flag
FROM
  (
    (
      (
        demands d
        LEFT JOIN profiles p ON ((d.contact_profile_id = p.id))
      )
      LEFT JOIN compensation_currencies cc ON ((d.compensation_currency_id = cc.id))
    )
    LEFT JOIN compensation_types ct ON ((d.compensation_type_id = ct.id))
  )
  LEFT JOIN LATERAL (
    SELECT
      array_agg(r.id) AS recruiter_ids,
      array_agg(r.full_name) AS recruiter_names
    FROM
      (
        demand_ta_allocations dta
        JOIN profiles r ON ((r.id = dta.ta_id))
      )
    WHERE
      (dta.demand_id = d.id)
  ) ta ON (TRUE);
