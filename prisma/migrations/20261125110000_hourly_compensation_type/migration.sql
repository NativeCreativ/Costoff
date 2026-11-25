-- Review of 18 Nov 2026, item 10: "Hourly" in Compensation Type (it was only in the demo seed).
INSERT INTO "compensation_types" ("name", "sort_order")
SELECT 'Hourly', COALESCE((SELECT MAX("sort_order") FROM "compensation_types"), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM "compensation_types" WHERE lower("name") = 'hourly');
