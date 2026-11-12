-- Enforces "a candidate may have at most one ACTIVE pipeline entry per demand" at the DB
-- level, closing the race window the application-level check alone can't close.
--
-- Report, never auto-delete: if any active duplicates already exist, abort loudly instead of
-- silently keeping one row and deleting the rest.
DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT demand_id, candidate_id FROM submissions
    WHERE is_active = true AND demand_id IS NOT NULL AND candidate_id IS NOT NULL
    GROUP BY demand_id, candidate_id HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate active (demand_id, candidate_id) pairs in submissions — resolve manually before re-running this migration. Inspect with: SELECT demand_id, candidate_id, count(*) FROM submissions WHERE is_active GROUP BY demand_id, candidate_id HAVING count(*) > 1;', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "submissions_active_demand_candidate_key"
  ON "submissions" (demand_id, candidate_id) WHERE is_active = true;
