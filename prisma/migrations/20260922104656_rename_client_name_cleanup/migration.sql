-- Drop the view first since it references these columns via SELECT *.
DROP VIEW IF EXISTS v_demands_with_aging;

-- DropForeignKey (client_id is being removed)
ALTER TABLE "demands" DROP CONSTRAINT IF EXISTS "demands_client_id_fkey";

-- Rename account_name -> client_name (Client Name is the source of truth
-- going forward; the old client_id FK to a real clients row was never
-- actually populated by the app, so it's dropped rather than reconciled).
ALTER TABLE "demands" RENAME COLUMN "account_name" TO "client_name";

-- Drop unused columns
ALTER TABLE "demands"
  DROP COLUMN IF EXISTS "external_requisition_id",
  DROP COLUMN IF EXISTS "client_id",
  DROP COLUMN IF EXISTS "notes";

-- Recreate the view without the removed columns, and without the computed
-- client_name JOIN (the base table's own client_name column is now used
-- directly instead).
CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    p.full_name AS am_name,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status = 'Open') AS is_red_flag
FROM demands d
LEFT JOIN profiles p ON d.created_by = p.id;
