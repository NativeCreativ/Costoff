-- v_demands_with_aging.am_name was joined on demands.created_by (the demand's
-- creator), but every consumer (the Demands list "Client Contact" column, the
-- Overview tab's "Account Manager" field, the dashboard's "assignedAM", and the
-- global search index) treats am_name as the currently ASSIGNED AM/SPOC contact.
-- A demand created by one user (e.g. Super Admin) and assigned to another AM
-- (contact_profile_id) was showing the creator's name instead of the assignee's.
-- Fix the join to resolve the assigned contact, not the creator.
DROP VIEW IF EXISTS v_demands_with_aging;

CREATE VIEW v_demands_with_aging AS
SELECT
  d.id,
  d.request_id,
  d.role_category,
  d.client_name,
  d.skill_description,
  d.technology_stack,
  d.experience_level,
  d.locations,
  d.budget_min,
  d.budget_max,
  d.num_positions,
  d.status,
  d.priority,
  d.created_by,
  d.opened_at,
  d.closed_at,
  d.created_at,
  d.updated_at,
  d.job_title,
  d.work_mode,
  d.company_name,
  d.company_email,
  d.updated_by,
  d.contact_profile_id,
  p.full_name AS am_name,
  COALESCE(ta.recruiter_ids, ARRAY[]::uuid[]) AS recruiter_ids,
  COALESCE(ta.recruiter_names, ARRAY[]::text[]::character varying[]) AS recruiter_names,
  GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
  (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status != 'Closure') AS is_red_flag
FROM demands d
LEFT JOIN profiles p ON d.contact_profile_id = p.id
LEFT JOIN LATERAL (
  SELECT array_agg(r.id) AS recruiter_ids, array_agg(r.full_name) AS recruiter_names
  FROM demand_ta_allocations dta
  JOIN profiles r ON r.id = dta.ta_id
  WHERE dta.demand_id = d.id
) ta ON TRUE;
