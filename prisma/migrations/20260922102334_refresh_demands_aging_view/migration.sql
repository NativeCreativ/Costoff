-- Postgres freezes a view's column list/order to whatever existed at CREATE
-- VIEW time; SELECT * does not automatically pick up new columns added to
-- the underlying table afterwards, and CREATE OR REPLACE VIEW cannot insert
-- columns in the middle of the existing list. Drop and recreate so it
-- re-expands against the current "demands" columns (job_title, work_mode,
-- company_name, company_email, updated_by, contact_profile_id).
DROP VIEW IF EXISTS v_demands_with_aging;

CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    c.name AS client_name,
    p.full_name AS am_name,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status = 'Open') AS is_red_flag
FROM demands d
LEFT JOIN clients c ON d.client_id = c.id
LEFT JOIN profiles p ON d.created_by = p.id;
