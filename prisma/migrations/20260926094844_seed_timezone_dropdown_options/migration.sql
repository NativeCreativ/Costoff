-- Seeds dropdown_masters with category='time_zone' so the Interview form's Time Zone field
-- can be a real DB-backed dropdown instead of free text. This table already existed with the
-- right shape (category/value/sort_order/is_active) but was never used for any dropdown.
-- Additive only — no destructive change, no existing rows touched.

INSERT INTO "dropdown_masters" ("category", "value", "sort_order", "is_active")
VALUES
  ('time_zone', 'Asia/Kolkata', 1, true),
  ('time_zone', 'Asia/Dubai', 2, true),
  ('time_zone', 'Asia/Singapore', 3, true),
  ('time_zone', 'Asia/Tokyo', 4, true),
  ('time_zone', 'Europe/London', 5, true),
  ('time_zone', 'Europe/Berlin', 6, true),
  ('time_zone', 'America/New_York', 7, true),
  ('time_zone', 'America/Chicago', 8, true),
  ('time_zone', 'America/Denver', 9, true),
  ('time_zone', 'America/Los_Angeles', 10, true),
  ('time_zone', 'Australia/Sydney', 11, true),
  ('time_zone', 'UTC', 12, true);
