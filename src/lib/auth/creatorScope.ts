/**
 * The single decision behind "creator owns edit/delete" for recruiters.
 *
 * Kept in its own module, and as a PURE function, because the same rule is enforced in
 * four different places (candidate PUT/DELETE, interview PUT/PATCH/DELETE, the pipeline
 * status transition, and the per-row UI flags). Having one function means the candidate
 * path and the interview path can never drift apart.
 *
 * The rule, in full:
 *
 *   demand assignment  ->  view + create
 *   creator ownership  ->  edit + delete
 *
 * so for a Recruiter editing a record inside a demand they are allocated to:
 *
 *   - adder is null, or the adder is not a Recruiter (an Account Manager / Super Admin
 *     created it)  ->  DENIED. There is no recruiter creator to defer to, so the assigned
 *     recruiters keep view + create only. This is the spec's "special case".
 *   - adder is a Recruiter, is still allocated to this demand, and is you  ->  ALLOWED.
 *   - adder is a Recruiter, is still allocated, and is somebody else      ->  DENIED.
 *   - adder is a Recruiter who is NO LONGER allocated to this demand      ->  ALLOWED for
 *     any allocated recruiter. Without this the record would be permanently uneditable
 *     by anyone below Super Admin, stranding the demand whenever somebody leaves or is
 *     re-assigned. This is the only place the creator tie is relaxed, and it never
 *     applies to an AM/Super Admin creator.
 *
 * Non-`ta` roles are decided by their own rules (super_admin unrestricted,
 * account_manager on demands they own) and never reach this function.
 */

export interface CreatorEditInput {
  /** The acting user. */
  actorId: string;
  /** profiles.id that created/added the record, or null when unknown. */
  creatorId: string | null | undefined;
  /** Whether `creatorId` is a Recruiter (profiles.role === 'ta'). False for null. */
  creatorIsRecruiter: boolean;
  /** The demand's CURRENT demand_ta_allocations.ta_id list. */
  currentRecruiterIds: string[];
}

/** True when this actor may edit/delete the record. See the module docblock. */
export function canEditAsRecordCreator(input: CreatorEditInput): boolean {
  const { actorId, creatorId, creatorIsRecruiter, currentRecruiterIds } = input;
  // No creator, or the creator is an AM/Super Admin -> no recruiter owns this record.
  if (!creatorId || !creatorIsRecruiter) return false;
  // The creator is still on this demand -> creator ownership decides.
  if (currentRecruiterIds.includes(creatorId)) return creatorId === actorId;
  // The creator has left this demand -> the tie is dropped so nothing is stranded.
  return true;
}

/** Why a recruiter cannot edit/delete this record, phrased for the UI / 403 body. */
export function creatorEditBlockMessage(input: CreatorEditInput, subject = 'this record'): string {
  const { creatorId, creatorIsRecruiter, currentRecruiterIds } = input;
  if (!creatorId || !creatorIsRecruiter) {
    return `This ${subject} was added by an Account Manager or Super Admin. Assigned recruiters can view it and add to the pipeline, but only an Account Manager (on their own demand) or a Super Admin can edit or delete it.`;
  }
  if (!currentRecruiterIds.includes(creatorId)) {
    return `You cannot manage ${subject}.`;
  }
  return `This ${subject} was added by another recruiter on this demand. You can view it and add to the pipeline, but only the recruiter who added it can edit or delete it.`;
}
