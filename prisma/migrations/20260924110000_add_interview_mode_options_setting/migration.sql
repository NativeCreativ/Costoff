-- Interview Mode was a static frontend-only list; make it a configurable Super Admin
-- setting like the other demand-fulfillment options (resume cap, interview rounds,
-- onboarding/BGV checklists), seeded with industry-standard defaults.
INSERT INTO "super_admin_settings" ("key", "value")
VALUES ('interview_mode_options', '["Video", "In-Person", "Phone", "Technical Test", "Group Discussion"]')
ON CONFLICT ("key") DO NOTHING;
