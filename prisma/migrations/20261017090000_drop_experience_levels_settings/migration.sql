-- Removes the Demand Fulfillment Settings "Experience levels" tab (data, APIs and UI) entirely,
-- per explicit instruction — superseding the earlier restore in
-- 20261016090000_drop_company_experience_levels_restore_global. The Demand form's own
-- Experience Level stays a free-text chip list (demands.experience_levels), unaffected.
--
-- Archived (not deleted outright) for reversibility, upserting into the same
-- "settings_experience_levels_archive" table the original removal created, so whichever version
-- of the data existed at drop time is the one preserved.
INSERT INTO "settings_experience_levels_archive" ("id", "name", "sort_order", "is_active")
SELECT "id", "name", "sort_order", "is_active" FROM "experience_levels"
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "sort_order" = EXCLUDED."sort_order", "is_active" = EXCLUDED."is_active";

DROP TABLE "experience_levels";
