-- Drop the view first since it will be recreated to expose recruiter_name.
DROP VIEW IF EXISTS v_demands_with_aging;

-- AlterTable: track which Recruiter (TA) owns/handles this company's requirement,
-- separate from contact_profile_id (the AM/SPOC who spoke with the company).
ALTER TABLE "demands" ADD COLUMN "recruiter_id" UUID;
ALTER TABLE "demands" ADD CONSTRAINT "demands_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Recreate the view with the recruiter's display name joined in.
CREATE VIEW v_demands_with_aging AS
SELECT
    d.*,
    p.full_name AS am_name,
    r.full_name AS recruiter_name,
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at))::INT) AS days_open,
    (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > 30 AND d.status != 'Closure') AS is_red_flag
FROM demands d
LEFT JOIN profiles p ON d.created_by = p.id
LEFT JOIN profiles r ON d.recruiter_id = r.id;
