-- Split the dual-purpose demands.contact_profile_id (AM-or-SPOC) into two
-- independent columns: contact_profile_id (Account Manager / owner, unchanged
-- meaning) and the new spoc_profile_id (SPOC contact). demand_ta_allocations
-- (recruiters) is untouched — it was already independent.
--
-- Why: contact_profile_id could only ever hold one id, so a demand's AM and its
-- SPOC could never be recorded/visible/searched independently — see the audit
-- in docs/ (or the accompanying report) for the full investigation. This is the
-- minimum schema change that lets AM, SPOC and Recruiter be set and validated
-- independently without introducing a parallel assignment table.

ALTER TABLE "demands" ADD COLUMN "spoc_profile_id" UUID;

ALTER TABLE "demands"
  ADD CONSTRAINT "demands_spoc_profile_id_fkey"
  FOREIGN KEY ("spoc_profile_id") REFERENCES "profiles"("id") ON UPDATE NO ACTION;

CREATE INDEX "demands_spoc_profile_id_idx" ON "demands" ("spoc_profile_id");

-- Backfill: any demand whose contact_profile_id currently points to a SPOC
-- profile had that SPOC recorded in the AM-or-SPOC field. Move it to the new
-- spoc_profile_id column and clear contact_profile_id (it no longer has a
-- known AM — this matches reality; the demand simply had no AM recorded before
-- SPOC/AM were split), so contact_profile_id becomes reliably AM-only.
UPDATE "demands" d
SET "spoc_profile_id" = d."contact_profile_id",
    "contact_profile_id" = NULL
FROM "profiles" p
WHERE d."contact_profile_id" = p."id"
  AND p."role" = 'spoc';

-- Data-quality cleanup: contact_profile_id should only ever be an
-- account_manager now. Clear any row pointing at a non-AM profile (e.g. the
-- 'ta' anomaly found during the audit) rather than leaving invalid state.
UPDATE "demands" d
SET "contact_profile_id" = NULL
WHERE d."contact_profile_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "profiles" p WHERE p."id" = d."contact_profile_id" AND p."role" = 'account_manager'
  );

-- Cleanup before adding the uniqueness guard below: the audit found demand_id
-- 99cfc417-de0c-4f46-94b3-dc61a6404277 with 9 simultaneously-active
-- account_manager rows and 8 simultaneously-active spoc rows in
-- demand_assignments (nothing previously deactivated old rows on reassignment).
-- Deactivate every row except the most recently assigned one per
-- (demand_id, role_in_demand) for account_manager/spoc, so history is preserved
-- (rows are kept, just marked inactive) while current state becomes consistent.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY demand_id, role_in_demand
           ORDER BY assigned_at DESC, id DESC
         ) AS rn
  FROM demand_assignments
  WHERE is_active = true AND role_in_demand IN ('account_manager', 'spoc')
)
UPDATE demand_assignments
SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Guard against future drift the same way: an active demand_assignments row can
-- only be unique per (demand_id, role_in_demand, user_id) already via app logic,
-- but nothing stopped multiple *different* users being active for the same
-- (demand_id, role_in_demand) at once (observed in the audit). A partial unique
-- index enforces "at most one active account_manager / spoc per demand" so this
-- table can safely be treated as consistent going forward. Recruiters are
-- intentionally excluded (a demand can have multiple active recruiters).
CREATE UNIQUE INDEX "demand_assignments_one_active_owner_per_demand"
  ON "demand_assignments" ("demand_id", "role_in_demand")
  WHERE "is_active" = true AND "role_in_demand" IN ('account_manager', 'spoc');

-- Recreate the view to expose both contact_profile_id (AM) and the new
-- spoc_profile_id (SPOC) independently, each resolved to its own name.
DROP VIEW IF EXISTS v_demands_with_aging;

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
  d.budget_min,
  d.budget_max,
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
  d.spoc_profile_id,
  am.full_name AS am_name,
  spoc.full_name AS spoc_name,
  COALESCE(ta.recruiter_ids, ARRAY[]::uuid[]) AS recruiter_ids,
  COALESCE(ta.recruiter_names, ARRAY[]::text[]::character varying[]) AS recruiter_names,
  GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
  (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status != 'Closure') AS is_red_flag
FROM demands d
LEFT JOIN profiles am ON d.contact_profile_id = am.id
LEFT JOIN profiles spoc ON d.spoc_profile_id = spoc.id
LEFT JOIN LATERAL (
  SELECT array_agg(r.id) AS recruiter_ids, array_agg(r.full_name) AS recruiter_names
  FROM demand_ta_allocations dta
  JOIN profiles r ON r.id = dta.ta_id
  WHERE dta.demand_id = d.id
) ta ON TRUE;
