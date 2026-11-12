-- Fills `company_interview_rounds` for any company that still has none, from its most recent
-- demand that saved interview rounds. Run once after the company-rounds source-of-truth change.
--
-- Why this exists: before that change, a company's rounds were overwritten by whichever demand
-- was saved last, so most companies ended up with rounds that came from an arbitrary demand (and
-- some ended up with none at all). With the new rules the company's rounds are only ever written
-- by Clients Master or by the FIRST demand that seeds a company with zero rounds — which means a
-- company with no rounds today would stay empty until someone edited it by hand. This migration
-- gives those companies the sensible starting point: the rounds of their latest demand.
--
-- Strictly one-time and strictly additive:
--   - it only touches companies with ZERO company_interview_rounds rows, so any configuration
--     already present (from Clients Master or from an earlier backfill) is never overwritten;
--   - every write is re-guarded by that same check, plus ON CONFLICT DO NOTHING, so re-running
--     this migration is always a safe no-op;
--   - existing demands are NOT modified in any way. Their rounds are already materialized and
--     stay exactly as they are; this only fills in the company-level default for future demands.

-- Step 1: one eligible company -> the most recent demand that actually has rounds.
-- "Latest" is (updated_at, created_at) so a demand that was just re-edited counts as the most
-- recent source. Rounds are taken from the demand's explicit configuration (demand_interview_config)
-- when it has one, otherwise from its materialized demand_interview_rounds rows.
CREATE TEMP TABLE _company_rounds_source AS
SELECT DISTINCT ON (src.company_id)
  src.company_id,
  src.rounds
FROM (
  SELECT
    d.company_id AS company_id,
    COALESCE(d.updated_at, d.created_at, to_timestamp(0)) AS activity_at,
    dic.rounds AS rounds,
    0 AS source_priority
  FROM demands d
  JOIN demand_interview_config dic ON dic.demand_id = d.id
  WHERE d.company_id IS NOT NULL
    AND jsonb_typeof(dic.rounds) = 'array'
    AND jsonb_array_length(dic.rounds) > 0

  UNION ALL

  SELECT
    d.company_id AS company_id,
    COALESCE(d.updated_at, d.created_at, to_timestamp(0)) AS activity_at,
    (
      SELECT jsonb_agg(
        jsonb_build_object('name', dir.name, 'mandatory', dir.mandatory)
        ORDER BY dir.round_order
      )
      FROM demand_interview_rounds dir
      WHERE dir.demand_id = d.id
    ) AS rounds,
    1 AS source_priority
  FROM demands d
  WHERE d.company_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM demand_interview_rounds dir WHERE dir.demand_id = d.id)
) src
WHERE src.rounds IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_interview_rounds cir WHERE cir.company_id = src.company_id
  )
ORDER BY src.company_id, src.activity_at DESC, src.source_priority ASC;

-- Step 2: give every referenced round name a master interview_rounds row. Reused by normalized
-- name (the same dedup rule the master itself enforces), never duplicated.
INSERT INTO interview_rounds (name, sort_order, is_active)
SELECT DISTINCT TRIM(BOTH ' ' FROM elem->>'name'), 0, true
FROM _company_rounds_source s, LATERAL jsonb_array_elements(s.rounds) elem
WHERE NULLIF(TRIM(BOTH ' ' FROM elem->>'name'), '') IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: insert one mapping row per company per round, with the order RE-derived as a dense
-- 1..n sequence rather than copied from the source demand. The stored order must stay gap-free
-- because company_interview_rounds is UNIQUE(company_id, round_order), and a demand's own list
-- may legitimately carry sparse or duplicated order values. Blank names are skipped, and two
-- names that collide once trimmed+lowercased collapse onto the first occurrence so the
-- (company_id, round_id) unique index can never be violated.
WITH _elements AS (
  SELECT s.company_id, elem.ord, elem.value
  FROM _company_rounds_source s,
       LATERAL jsonb_array_elements(s.rounds) WITH ORDINALITY AS elem(value, ord)
),
-- Names that collide once trimmed + lowercased collapse onto their FIRST occurrence (ordered by
-- position in the source list), so the UNIQUE(company_id, round_id) index can never be violated
-- and blank names drop out entirely.
_deduped AS (
  SELECT DISTINCT ON (company_id, LOWER(TRIM(BOTH ' ' FROM value->>'name')))
    company_id,
    ord,
    TRIM(BOTH ' ' FROM value->>'name') AS name,
    COALESCE((value->>'mandatory')::boolean, false) AS mandatory
  FROM _elements
  WHERE NULLIF(TRIM(BOTH ' ' FROM value->>'name'), '') IS NOT NULL
  ORDER BY company_id, LOWER(TRIM(BOTH ' ' FROM value->>'name')), ord
),
-- The stored order is RE-DERIVED as a dense 1..n over each company's deduplicated list, ordered
-- by the source demand's own order. The source's order values are never copied, since a demand's
-- list may legitimately carry sparse or duplicated ones.
_numbered AS (
  SELECT company_id, name, mandatory,
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY ord) AS rn
  FROM _deduped
)
INSERT INTO company_interview_rounds (company_id, round_id, round_order, mandatory)
SELECT n.company_id, ir.id, n.rn, n.mandatory
FROM _numbered n
JOIN interview_rounds ir ON LOWER(TRIM(ir.name)) = LOWER(n.name)
WHERE NOT EXISTS (SELECT 1 FROM company_interview_rounds cir WHERE cir.company_id = n.company_id)
ON CONFLICT DO NOTHING;

DROP TABLE _company_rounds_source;