-- Demand "Experience Level" becomes a free-text chip list (string[]), entered the same way as
-- "Locations", instead of a single value picked from a master list. Column shape matches
-- "locations"/"technology_stack" (plain nullable TEXT[] - the API always writes an array).
--
-- Reversible: re-add "experience_level" VARCHAR(100), backfill from experience_levels[1] (the
-- first stored chip, or NULL when the list is empty), then drop "experience_levels".
ALTER TABLE "demands" ADD COLUMN "experience_levels" TEXT[];

UPDATE "demands"
SET "experience_levels" = CASE
  WHEN "experience_level" IS NULL OR btrim("experience_level") = '' THEN ARRAY[]::TEXT[]
  ELSE ARRAY[btrim("experience_level")]
END;

ALTER TABLE "demands" DROP COLUMN "experience_level";
