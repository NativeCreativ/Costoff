-- Backfills `company_interview_rounds` from each company's most recent demand that saved its
-- own interview rounds. The table was created by migration 20261005120000 but was never
-- populated from existing demand data, so most companies have had zero mapping rows until now
-- (and the Add Demand form had nothing to auto-load even for a company with a clear round
-- history).
--
-- Only touches companies with ZERO existing company_interview_rounds rows — never overwrites a
-- row already configured via the Company settings screen or a prior demand save. Idempotent:
-- every write is guarded by that same "company has no rows yet" check, so re-running this
-- migration (or finding it already applied) is always a safe no-op.

-- Step 1: for each eligible company, the single most recent demand (by created_at) whose
-- demand_interview_config.rounds is a non-empty array.
CREATE TEMP TABLE _backfill_source AS
SELECT DISTINCT ON (d.company_id)
  d.company_id AS company_id,
  dic.rounds AS rounds
FROM demands d
JOIN demand_interview_config dic ON dic.demand_id = d.id
WHERE d.company_id IS NOT NULL
  AND jsonb_typeof(dic.rounds) = 'array'
  AND jsonb_array_length(dic.rounds) > 0
  AND NOT EXISTS (
    SELECT 1 FROM company_interview_rounds cir WHERE cir.company_id = d.company_id
  )
ORDER BY d.company_id, d.created_at DESC;

-- Step 2: ensure every referenced round name has a master interview_rounds row — reused by
-- normalized name (same dedup rule the master itself enforces), never duplicated.
INSERT INTO interview_rounds (name, sort_order, is_active)
SELECT DISTINCT TRIM(BOTH ' ' FROM elem->>'name'), 0, true
FROM _backfill_source s, LATERAL jsonb_array_elements(s.rounds) elem
WHERE NULLIF(TRIM(BOTH ' ' FROM elem->>'name'), '') IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: insert the company's mapping rows in the demand's saved order/mandatory flags.
-- Re-guarded here (not just in step 1) so this statement alone stays idempotent even if run
-- in isolation. ON CONFLICT DO NOTHING additionally protects against any pre-existing bad data
-- that happened to share an (company_id, round_order) or (company_id, round_id) pair.
INSERT INTO company_interview_rounds (company_id, round_id, round_order, mandatory)
SELECT
  s.company_id,
  ir.id,
  (elem->>'order')::int,
  COALESCE((elem->>'mandatory')::boolean, false)
FROM _backfill_source s
JOIN LATERAL jsonb_array_elements(s.rounds) elem ON true
JOIN interview_rounds ir ON LOWER(TRIM(ir.name)) = LOWER(TRIM(elem->>'name'))
WHERE NULLIF(TRIM(BOTH ' ' FROM elem->>'name'), '') IS NOT NULL
  AND (elem->>'order') ~ '^\d+$'
  AND NOT EXISTS (SELECT 1 FROM company_interview_rounds cir WHERE cir.company_id = s.company_id)
ON CONFLICT DO NOTHING;

DROP TABLE _backfill_source;
