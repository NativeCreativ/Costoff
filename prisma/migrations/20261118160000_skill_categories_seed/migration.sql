-- App review batch 5 (Nov 2026): the Skill Categories the client listed, added only if missing.
-- They stay editable / deactivatable in Master Data → Skills Management.
INSERT INTO "skill_classifications" ("name", "sort_order")
SELECT v.name, v.sort_order
FROM (VALUES ('Non-technical', 4), ('Engineering', 5), ('SemiConductor', 6)) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "skill_classifications" s WHERE lower(s."name") = lower(v.name));
