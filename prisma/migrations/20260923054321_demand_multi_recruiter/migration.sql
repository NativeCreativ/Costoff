-- Drop the view first since it references demands.recruiter_id.
DROP VIEW IF EXISTS v_demands_with_aging;

-- Backfill: migrate any existing single recruiter_id assignments into the
-- many-to-many demand_ta_allocations table before dropping the column.
INSERT INTO demand_ta_allocations (demand_id, ta_id)
SELECT id, recruiter_id FROM demands
WHERE recruiter_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Prevent duplicate (demand, recruiter) allocations going forward.
ALTER TABLE "demand_ta_allocations" ADD CONSTRAINT "demand_ta_allocations_demand_id_ta_id_key" UNIQUE ("demand_id", "ta_id");

-- Drop the now-redundant single-recruiter column and its FK.
ALTER TABLE "demands" DROP CONSTRAINT IF EXISTS "demands_recruiter_id_fkey";
ALTER TABLE "demands" DROP COLUMN IF EXISTS "recruiter_id";

-- Recreate the view: recruiter_ids / recruiter_names are now arrays
-- aggregated from demand_ta_allocations (a demand can have multiple TAs).
CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    p.full_name AS am_name,
    COALESCE(ta.recruiter_ids, ARRAY[]::UUID[]) AS recruiter_ids,
    COALESCE(ta.recruiter_names, ARRAY[]::TEXT[]) AS recruiter_names,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status != 'Closure') AS is_red_flag
FROM demands d
LEFT JOIN profiles p ON d.created_by = p.id
LEFT JOIN LATERAL (
    SELECT
        array_agg(r.id) AS recruiter_ids,
        array_agg(r.full_name) AS recruiter_names
    FROM demand_ta_allocations dta
    JOIN profiles r ON r.id = dta.ta_id
    WHERE dta.demand_id = d.id
) ta ON true;
