-- Drop the view first since it references demands.status.
DROP VIEW IF EXISTS v_demands_with_aging;

-- Backfill existing rows from the old 3-value status set to the new
-- 6-stage pipeline (Assign -> Sourcing -> Shortlist -> Selection ->
-- Onboarding -> Closure).
UPDATE "demands" SET "status" = 'Assign' WHERE "status" = 'Open';
UPDATE "demands" SET "status" = 'Sourcing' WHERE "status" = 'In Progress';
UPDATE "demands" SET "status" = 'Closure' WHERE "status" = 'Closed';

-- AlterTable: new demands default to the initial "Assign" stage.
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'Assign';

-- Recreate the view. "Open"-based aging/red-flag logic is replaced with
-- "not yet in Closure" (the demand is still active work, regardless of
-- which of the 5 non-final stages it's in).
CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    p.full_name AS am_name,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status != 'Closure') AS is_red_flag
FROM demands d
LEFT JOIN profiles p ON d.created_by = p.id;
