-- Clients Master becomes the single source of truth for interview rounds, round modes and
-- experience levels. This removes the Demand Fulfillment Settings lists that duplicated them.
--
-- SAFETY NOTE ON REFERENCES (verified before writing this migration):
--   * interviews.mode      is ALREADY plain text (VARCHAR(50)) - never a mode id
--   * interviews.level     is ALREADY plain text (VARCHAR(50)) - a round-name snapshot
--   * demands.experience_level is ALREADY plain text
--   * demand_interview_config.rounds is JSON holding round NAMES
--   * demand_interview_rounds.name is plain text
-- So no record stores an id into interview_rounds_default / interview_mode_options /
-- experience_levels. Nothing has to be converted before the drop; every historical demand,
-- candidate and interview keeps its own round/mode/level wording untouched.
--
-- The values are still archived below into a plain-text table so the removal is REVERSIBLE.

-- 1. Archive the two super_admin_settings values (plain text) before deleting them.
CREATE TABLE IF NOT EXISTS "settings_key_archive" (
  "key"        TEXT PRIMARY KEY,
  "value"      JSONB,
  "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

INSERT INTO "settings_key_archive" ("key", "value")
SELECT "key", "value" FROM "super_admin_settings"
WHERE "key" IN ('interview_rounds_default', 'interview_mode_options')
ON CONFLICT ("key") DO NOTHING;

-- 2. Archive the global experience levels as plain text rows, then drop the table.
CREATE TABLE IF NOT EXISTS "settings_experience_levels_archive" (
  "id"      UUID PRIMARY KEY,
  "name"    VARCHAR(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

INSERT INTO "settings_experience_levels_archive" ("id", "name", "sort_order", "is_active")
SELECT "id", "name", "sort_order", COALESCE("is_active", true) FROM "experience_levels"
ON CONFLICT ("id") DO NOTHING;

DROP TABLE "experience_levels";

DELETE FROM "super_admin_settings" WHERE "key" IN ('interview_rounds_default', 'interview_mode_options');

-- 3. Round MODE (optional free text) on the company round and on the materialized demand round,
--    so a mode travels with the round instead of coming from a global list.
--    Existing rows get mode = NULL - that is a valid save and changes nothing historical.
ALTER TABLE "company_interview_rounds" ADD COLUMN "mode" VARCHAR(100);
ALTER TABLE "demand_interview_rounds" ADD COLUMN "mode" VARCHAR(100);