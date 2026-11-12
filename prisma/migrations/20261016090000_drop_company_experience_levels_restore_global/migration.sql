-- This task supersedes the Clients Master "Experience levels" section added by migration
-- 20261014120000_add_company_spoc_and_experience_levels: it is removed again below. Demand's own
-- Experience Level becomes a free-text chip list instead (see
-- 20261016091500_demand_experience_levels_array), independent of any master list.
--
-- 1. Drop companies.experience_levels. Reversible: re-add as
--    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] — no data loss, every row was still the column
--    default on this branch.
ALTER TABLE "companies" DROP COLUMN "experience_levels";

-- 2. Restore the global Demand Fulfillment Settings "Experience levels" list. Migration
--    20261015120000_company_source_of_truth_rounds_modes_levels archived it (not deleted it) into
--    "settings_experience_levels_archive" for exactly this: that settings section, its data and
--    its APIs stay in place — only Demand/Company stop reading it. Recreated identically to the
--    original table from 20261013120000_add_experience_levels.
CREATE TABLE "experience_levels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(30) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "experience_levels_name_key" ON "experience_levels"(LOWER(TRIM("name")));

INSERT INTO "experience_levels" ("id", "name", "sort_order", "is_active")
SELECT "id", substring(btrim("name") for 30), "sort_order", "is_active"
FROM "settings_experience_levels_archive"
ON CONFLICT DO NOTHING;
