import { Prisma } from '@/generated/prisma/client';

/** Red-flag threshold, ported verbatim from the removed `v_demands_with_aging` view. */
import { DEMAND_RED_FLAG_DAYS } from '@/lib/demandFulfillment/constants';
export { DEMAND_RED_FLAG_DAYS };

/** Approaching-red-flag threshold (days). A demand is "approaching" when
 *  days_open >= DEMAND_APPROACHING_DAYS and <= DEMAND_RED_FLAG_DAYS. */
export const DEMAND_APPROACHING_DAYS = 20;

export const DEMANDS_WITH_AGING_BASE = Prisma.sql`
  SELECT
    d.id, d.request_id, d.role_category, d.client_name, d.skill_description,
    d.technology_stack, d.experience_levels, d.locations,
    d.compensation_currency_id, d.compensation_type_id, d.compensation_min, d.compensation_max,
    d.num_positions, d.status, d.priority, d.created_by, d.opened_at, d.closed_at,
    d.created_at, d.updated_at, d.job_title, d.work_mode, d.company_name, d.company_email,
    d.updated_by, d.contact_profile_id, d.spoc_profile_id, d.company_id,
    d.cloned_from_demand_id, d.cloned_at, d.cloned_by,
    d.skills_category_id, d.end_client_id, d.demand_type,
    d.engagement_type, d.client_demand_id, d.intermediary_partner, d.shift_timings, d.comments, d.other_details, d.is_draft, d.customer_jd, d.client_spoc_ids,
    d.work_modes, d.customer_jd_file_url, d.customer_jd_file_name,
    d.total_experience, d.relevant_experience, d.certifications,
    src.request_id AS cloned_from_request_id,
    am.full_name AS am_name,
    spoc.full_name AS spoc_name,
    co.city AS company_city,
    co.country AS company_country,
    co.website AS company_website,
    ec.name AS end_client_name,
    sg.name AS skill_group_name,
    cloner.full_name AS cloned_by_name,
    cc.code AS compensation_currency_code,
    cc.symbol AS compensation_currency_symbol,
    cc.name AS compensation_currency_name,
    ct.name AS compensation_type_name,
    COALESCE(ta.recruiter_ids, ARRAY[]::uuid[]) AS recruiter_ids,
    COALESCE(ta.recruiter_names, (ARRAY[]::text[])::character varying[]) AS recruiter_names,
    GREATEST(0, (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)))::integer) AS days_open,
    (
      (EXTRACT(DAY FROM (COALESCE(d.closed_at, NOW()) - d.opened_at)) > ${DEMAND_RED_FLAG_DAYS})
      AND (d.status <> 'Closure')
    ) AS is_red_flag
  FROM demands d
  LEFT JOIN profiles am ON d.contact_profile_id = am.id
  LEFT JOIN profiles spoc ON d.spoc_profile_id = spoc.id
  LEFT JOIN companies co ON d.company_id = co.id
  LEFT JOIN end_clients ec ON d.end_client_id = ec.id
  LEFT JOIN skill_categories sg ON d.skills_category_id = sg.id
  LEFT JOIN profiles cloner ON d.cloned_by = cloner.id
  LEFT JOIN demands src ON d.cloned_from_demand_id = src.id
  LEFT JOIN compensation_currencies cc ON d.compensation_currency_id = cc.id
  LEFT JOIN compensation_types ct ON d.compensation_type_id = ct.id
  LEFT JOIN LATERAL (
    SELECT array_agg(r.id) AS recruiter_ids, array_agg(r.full_name) AS recruiter_names
    FROM demand_ta_allocations dta
    JOIN profiles r ON r.id = dta.ta_id
    WHERE dta.demand_id = d.id
  ) ta ON TRUE
`;
