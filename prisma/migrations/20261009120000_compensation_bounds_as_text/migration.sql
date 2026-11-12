-- Compensation bounds become free text.
--
-- They used to be DECIMAL(14,2). Nothing ever consumed the numeric value for display or
-- calculation (it is shown verbatim, e.g. "16LPA"), and parsing a bound like "6LPA" into a
-- number then back into a string is lossy and inconsistent. schema.prisma already declares
-- these as String? — this migration brings the actual column type in line with it.
--
-- The column type must change BEFORE any text is written into it (the previous version of
-- this migration tried to UPDATE the still-numeric column with a text expression first, which
-- Postgres rejects outright — "column compensation_min is of type numeric but expression is
-- of type text" — so it never applied). Existing numeric values are cast to a clean text
-- rendering: a whole number loses its ".00" (600000.00 -> "600000"); a genuine fractional
-- value keeps it.
ALTER TABLE "demands"
  ALTER COLUMN "compensation_min" TYPE VARCHAR(50)
    USING (CASE WHEN "compensation_min" = TRUNC("compensation_min") THEN TRUNC("compensation_min")::text ELSE "compensation_min"::text END),
  ALTER COLUMN "compensation_max" TYPE VARCHAR(50)
    USING (CASE WHEN "compensation_max" = TRUNC("compensation_max") THEN TRUNC("compensation_max")::text ELSE "compensation_max"::text END);

-- compensation_min_text / compensation_max_text (added by 20261008115323, staging columns for
-- this exact migration) were never written to by any app code — confirmed empty on every row
-- before writing this migration — but preferred here anyway in case any were ever set, so no
-- possible data is lost.
UPDATE "demands"
SET "compensation_min" = NULLIF(BTRIM("compensation_min_text"), '')
WHERE NULLIF(BTRIM("compensation_min_text"), '') IS NOT NULL;

UPDATE "demands"
SET "compensation_max" = NULLIF(BTRIM("compensation_max_text"), '')
WHERE NULLIF(BTRIM("compensation_max_text"), '') IS NOT NULL;

ALTER TABLE "demands"
  DROP COLUMN "compensation_min_text",
  DROP COLUMN "compensation_max_text";
