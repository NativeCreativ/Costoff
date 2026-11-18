import type { Prisma } from '@/generated/prisma/client';

/** `demand_change_events.scope` values. Assignment / status / pipeline history live in their own
 *  tables (demand_assignment_events, demand_status_events, submission_events). */
export const DEMAND_CHANGE_SCOPES = ['demand', 'candidate'] as const;
export type DemandChangeScope = (typeof DEMAND_CHANGE_SCOPES)[number];

/** A field's value reduced to what the log shows. Arrays become "a, b"; blank becomes null. */
export type ChangeLogValue = string | number | boolean | string[] | null | undefined | Date;

/** The demand fields the change log tracks, keyed by an internal name, with the label shown. */
export const DEMAND_CHANGE_FIELD_LABELS: Record<string, string> = {
  job_title: 'Job Title',
  skill_description: 'Job Summary',
  customer_jd: 'Client JD (text)',
  customer_jd_file_name: 'Client JD (file)',
  role_category: 'Demand Category',
  demand_type: 'Demand Type',
  engagement_type: 'Engagement',
  client_demand_id: 'Client Demand Id',
  intermediary_partner: 'Intermediary Partner',
  shift_timings: 'Shift Timings',
  comments: 'Comments',
  end_client: 'End Client',
  skill_group: 'Skill Group',
  required_skills: 'Required Skills',
  experience_levels: 'Experience Level',
  total_experience: 'Total Experience',
  relevant_experience: 'Relevant Experience',
  certifications: 'Certifications',
  work_modes: 'Work Mode',
  locations: 'Locations',
  num_positions: 'Positions',
  priority: 'Priority',
  status: 'Status',
  compensation_currency: 'Currency',
  compensation_type: 'Compensation Type',
  compensation_min: 'Minimum Compensation',
  compensation_max: 'Maximum Compensation',
};

/** Candidate profile fields the change log tracks (scope 'candidate'). Keys are column names. */
export const CANDIDATE_CHANGE_FIELD_LABELS: Record<string, string> = {
  full_name: 'Candidate name',
  email: 'Candidate email',
  phone: 'Candidate phone',
  alternate_phone: 'Alternate phone',
  current_location: 'Current location',
  preferred_locations: 'Preferred locations',
  current_company: 'Current company',
  current_designation: 'Current designation',
  total_experience: 'Total experience',
  skills: 'Key skills',
  qualification: 'Qualification',
  specialization: 'Specialization',
  current_ctc: 'Current CTC',
  expected_ctc: 'Expected CTC',
  available_from: 'Available from',
  availability: 'Notice / availability',
  work_mode: 'Candidate work mode',
  linked_url: 'LinkedIn URL',
  source: 'Source',
  offer_in_hand: 'Offer in hand',
  offer_company: 'Offer company',
  offer_ctc: 'Offer CTC',
  offer_doj: 'Offer joining date',
};

/** Every label the change log can show, keyed by the stored `field`. */
export const CHANGE_FIELD_LABELS: Record<string, string> = { ...DEMAND_CHANGE_FIELD_LABELS, ...CANDIDATE_CHANGE_FIELD_LABELS };

/** A candidate row reduced to the values the change log compares. Dates as YYYY-MM-DD. */
export function candidateChangeSnapshot(c: Record<string, unknown>): Record<string, ChangeLogValue> {
  const out: Record<string, ChangeLogValue> = {};
  for (const field of Object.keys(CANDIDATE_CHANGE_FIELD_LABELS)) {
    const value = c[field];
    if (value instanceof Date) out[field] = value.toISOString().slice(0, 10);
    else if (value !== null && typeof value === 'object' && 'toString' in value) out[field] = String(value); // Decimal
    else out[field] = value as ChangeLogValue;
  }
  return out;
}

/** Long free-text values are clipped in the log; the demand itself always keeps the full text. */
const MAX_LOGGED_VALUE_LENGTH = 2000;

export function toChangeLogText(value: ChangeLogValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean).join(', ')
    : String(value).trim();
  if (text === '') return null;
  return text.length > MAX_LOGGED_VALUE_LENGTH ? `${text.slice(0, MAX_LOGGED_VALUE_LENGTH)}…` : text;
}

export interface FieldChange {
  field: string;
  old_value: string | null;
  new_value: string | null;
}

/**
 * Field-by-field diff of two snapshots. Only keys present in `after` are compared, so a partial
 * edit that never sent a field logs nothing for it. Values are compared as the log would show
 * them, so ['a','b'] vs ['a','b'] or '' vs null is not a change.
 */
export function diffFields(
  before: Record<string, ChangeLogValue>,
  after: Record<string, ChangeLogValue>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(after)) {
    const oldValue = toChangeLogText(before[field]);
    const newValue = toChangeLogText(after[field]);
    if (oldValue !== newValue) changes.push({ field, old_value: oldValue, new_value: newValue });
  }
  return changes;
}

/** The shape demandChangeSnapshot reads: a demands row plus the few relations it names. */
export interface DemandChangeSource {
  job_title?: string | null;
  skill_description?: string | null;
  customer_jd?: string | null;
  customer_jd_file_name?: string | null;
  role_category?: string | null;
  demand_type?: string | null;
  engagement_type?: string | null;
  client_demand_id?: string | null;
  intermediary_partner?: string | null;
  shift_timings?: string | null;
  comments?: string | null;
  technology_stack?: string[] | null;
  experience_levels?: string[] | null;
  total_experience?: string | null;
  relevant_experience?: string | null;
  /** demands.certifications JSON: [{ name, type }]. */
  certifications?: unknown;
  work_mode?: string | null;
  work_modes?: string[] | null;
  locations?: string[] | null;
  num_positions?: number | null;
  priority?: string | null;
  status?: string | null;
  compensation_min?: string | null;
  compensation_max?: string | null;
  end_clients?: { name: string } | null;
  skill_categories?: { name: string } | null;
  compensation_currencies?: { code: string } | null;
  compensation_types?: { name: string } | null;
}

/** A demand reduced to the human-readable values the change log compares (names, not ids). */
export function demandChangeSnapshot(d: DemandChangeSource): Record<string, ChangeLogValue> {
  return {
    job_title: d.job_title,
    skill_description: d.skill_description,
    customer_jd: d.customer_jd,
    customer_jd_file_name: d.customer_jd_file_name,
    role_category: d.role_category,
    demand_type: d.demand_type,
    engagement_type: d.engagement_type,
    client_demand_id: d.client_demand_id,
    intermediary_partner: d.intermediary_partner,
    shift_timings: d.shift_timings,
    comments: d.comments,
    end_client: d.end_clients?.name ?? null,
    skill_group: d.skill_categories?.name ?? null,
    required_skills: d.technology_stack ?? [],
    experience_levels: d.experience_levels ?? [],
    total_experience: d.total_experience,
    relevant_experience: d.relevant_experience,
    certifications: Array.isArray(d.certifications)
      ? (d.certifications as { name?: unknown; type?: unknown }[]).map((c) => `${String(c?.name ?? '')} (${String(c?.type ?? '')})`)
      : [],
    work_modes: d.work_modes && d.work_modes.length > 0 ? d.work_modes : d.work_mode ? [d.work_mode] : [],
    locations: d.locations ?? [],
    num_positions: d.num_positions,
    priority: d.priority,
    status: d.status,
    compensation_currency: d.compensation_currencies?.code ?? null,
    compensation_type: d.compensation_types?.name ?? null,
    compensation_min: d.compensation_min,
    compensation_max: d.compensation_max,
  };
}

/** Snapshot keys whose source field the PUT body actually carried. */
export function sentChangeFields(
  values: Record<string, unknown>,
  sent: (key: 'recruiter_ids' | 'locations' | 'required_skills' | 'experience_levels') => boolean
): string[] {
  const has = (key: string) => values[key] !== undefined;
  const fields: [string, boolean][] = [
    ['job_title', has('job_title')],
    ['skill_description', has('skill_description')],
    ['customer_jd', has('customer_jd')],
    ['customer_jd_file_name', has('customer_jd_file_url')],
    ['role_category', has('role_category')],
    ['demand_type', has('demand_type')],
    ['engagement_type', has('engagement_type')],
    ['client_demand_id', has('client_demand_id')],
    ['intermediary_partner', has('intermediary_partner')],
    ['shift_timings', has('shift_timings')],
    ['comments', has('comments')],
    ['end_client', has('end_client_id')],
    ['skill_group', has('skills_category_id')],
    ['required_skills', sent('required_skills')],
    ['experience_levels', sent('experience_levels')],
    ['total_experience', has('total_experience')],
    ['relevant_experience', has('relevant_experience')],
    ['certifications', has('certifications')],
    ['work_modes', has('work_modes') || has('work_mode')],
    ['locations', sent('locations')],
    ['num_positions', has('num_positions')],
    ['priority', has('priority')],
    ['status', has('status')],
    ['compensation_currency', has('compensation_currency_id')],
    ['compensation_type', has('compensation_type_id')],
    ['compensation_min', has('compensation_min')],
    ['compensation_max', has('compensation_max')],
  ];
  return fields.filter(([, isSent]) => isSent).map(([field]) => field);
}

export function pickSent(snapshot: Record<string, ChangeLogValue>, fields: string[]): Record<string, ChangeLogValue> {
  return Object.fromEntries(fields.map((field) => [field, snapshot[field]]));
}

/** Writes change rows for one entity, inside the caller's transaction. No-op for an empty diff. */
export async function recordDemandChanges(
  tx: Prisma.TransactionClient,
  input: {
    demandId: string;
    scope: DemandChangeScope;
    changes: FieldChange[];
    actorId: string | null;
    entityId?: string | null;
    entityLabel?: string | null;
  }
): Promise<number> {
  if (input.changes.length === 0) return 0;
  const result = await tx.demand_change_events.createMany({
    data: input.changes.map((change) => ({
      demand_id: input.demandId,
      scope: input.scope,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel?.slice(0, 255) ?? null,
      field: change.field.slice(0, 100),
      old_value: change.old_value,
      new_value: change.new_value,
      created_by: input.actorId,
    })),
  });
  return result.count;
}

/** Assignment-event rows (demand_assignment_events) for a before/after id set. */
export function assignmentEventRows(input: {
  demandId: string;
  category: string;
  previousIds: (string | null | undefined)[];
  nextIds: (string | null | undefined)[];
  actorId: string;
}) {
  const previous = new Set(input.previousIds.filter((id): id is string => !!id));
  const next = new Set(input.nextIds.filter((id): id is string => !!id));
  const row = (action: 'assign' | 'unassign', subjectId: string) => ({
    demand_id: input.demandId,
    category: input.category,
    action,
    subject_id: subjectId,
    created_by: input.actorId,
  });
  return [
    ...[...previous].filter((id) => !next.has(id)).map((id) => row('unassign', id)),
    ...[...next].filter((id) => !previous.has(id)).map((id) => row('assign', id)),
  ];
}
