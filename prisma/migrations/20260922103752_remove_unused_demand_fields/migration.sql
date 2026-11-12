-- Drop the view first since it references these columns via SELECT *.
DROP VIEW IF EXISTS v_demands_with_aging;

-- DropForeignKey
ALTER TABLE "demands" DROP CONSTRAINT IF EXISTS "demands_poc_id_fkey";

-- AlterTable: remove unused dead columns (never read/written by the app)
ALTER TABLE "demands"
  DROP COLUMN IF EXISTS "buzzworks_id",
  DROP COLUMN IF EXISTS "poc_id",
  DROP COLUMN IF EXISTS "comments";

-- Recreate the view without the removed columns.
CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    c.name AS client_name,
    p.full_name AS am_name,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status = 'Open') AS is_red_flag
FROM demands d
LEFT JOIN clients c ON d.client_id = c.id
LEFT JOIN profiles p ON d.created_by = p.id;
