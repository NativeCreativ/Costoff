import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageDemandAssignments } from '@/lib/auth/demandFulfillmentPermissions';
import { DEMAND_ASSIGNMENT_ROLE_TO_PROFILE_ROLES } from '@/lib/demandFulfillment/constants';
import { demandAssignSchema } from '@/components/demandFulfillment/demandFulfillment.schema';
import { loadDemandContext } from '@/lib/demandFulfillment/loadDemandContext';
import { notifyNewlyAssigned, loadAssignmentState } from '@/lib/notifications/createDemandAssignmentNotifications';

// POST /api/demands/[requestId]/assign — assign AM/SPOC/recruiter(s) to a demand.
// Writes demand_assignments (audit trail) and mirrors onto the existing
// demands.contact_profile_id (AM) / spoc_profile_id (SPOC) / demand_ta_allocations
// (recruiters) columns, independently, so existing visibility/permission code
// (demandVisibility.ts, demandFulfillmentPermissions.ts) sees the same values.
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const currentUser = await requireAuth();
    const { requestId } = await params;

    const demand = await loadDemandContext(requestId);
    if (!demand) {
      return NextResponse.json({ error: 'Demand not found' }, { status: 404 });
    }
    const demandId = demand.id;
    if (!canManageDemandAssignments({ role: currentUser.role, id: currentUser.userId }, demand)) {
      return NextResponse.json({ error: 'You do not have permission to assign this demand' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = demandAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { remark, clear_roles: clearRoles = [], client_spoc_ids: clientSpocIds } = parsed.data;
    const clearRoleSet = new Set(clearRoles);

    // Only Super Admin may change the Account Manager via Assign/Reassign — an AM's own
    // ownership is fixed once set at creation and cannot be re-asserted or changed by
    // them here, even to themselves. Drop any account_manager entry for an AM actor
    // rather than rejecting, since the frontend already hides this selector for them.
    const assignments = currentUser.role === 'account_manager'
      ? parsed.data.assignments.filter((a) => a.role_in_demand !== 'account_manager')
      : parsed.data.assignments;

    // At most one account_manager and one spoc entry per call — demands.contact_profile_id /
    // spoc_profile_id are each single-valued, and the active-row unique index (see migration
    // 20260924170125_split_demand_spoc_assignment) only allows one active row per role anyway.
    const amEntries = assignments.filter((a) => a.role_in_demand === 'account_manager');
    const spocEntries = assignments.filter((a) => a.role_in_demand === 'spoc');
    if (amEntries.length > 1) {
      return NextResponse.json({ error: 'Only one Account Manager can be assigned at a time' }, { status: 400 });
    }
    if (spocEntries.length > 1) {
      return NextResponse.json({ error: 'Only one SPOC can be assigned at a time' }, { status: 400 });
    }

    const userIds = assignments.map((a) => a.user_id);
    const profiles = await prisma.profiles.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p.role]));

    for (const a of assignments) {
      const actualRole = profileById.get(a.user_id);
      const allowedRoles = DEMAND_ASSIGNMENT_ROLE_TO_PROFILE_ROLES[a.role_in_demand];
      if (!actualRole || !allowedRoles.includes(actualRole)) {
        return NextResponse.json(
          { error: `User ${a.user_id} is not an existing profile with role "${a.role_in_demand}"` },
          { status: 400 }
        );
      }
    }

    const amAssignment = amEntries[0];
    const spocAssignment = spocEntries[0];
    const recruiterAssignments = assignments.filter((a) => a.role_in_demand === 'recruiter');

    // Assignment state BEFORE this reassignment, for the "only notify newly assigned" diff.
    // Reassign submits the COMPLETE desired recruiter set (see the comment on the allocation
    // replace below), so this is what lets us notify only the newly added recruiters and stay
    // silent for the ones who were already on the demand (spec §4/§7).
    const previousAssignment = await loadAssignmentState(demandId);
    const demandRow = await prisma.demands.findUnique({
      where: { id: demandId },
      select: { request_id: true, job_title: true, skill_description: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate the previously active row for any role being reassigned here,
      // so demand_assignments' "current state" stays in sync with the mirrored
      // demands columns (only one active account_manager/spoc row is allowed).
      const rolesBeingSet = [...(amAssignment ? ['account_manager'] : []), ...(spocAssignment ? ['spoc'] : [])];
      if (rolesBeingSet.length > 0) {
        await tx.demand_assignments.updateMany({
          where: { demand_id: demandId, role_in_demand: { in: rolesBeingSet }, is_active: true },
          data: { is_active: false },
        });
      }

      const created = assignments.length === 0
        ? { count: 0 }
        : await tx.demand_assignments.createMany({
            data: assignments.map((a) => ({
              demand_id: demandId,
              user_id: a.user_id,
              role_in_demand: a.role_in_demand,
              assigned_by: currentUser.userId,
              remark: remark || null,
            })),
          });

      const updateData: { contact_profile_id?: string; spoc_profile_id?: string; updated_by: string } = {
        updated_by: currentUser.userId,
      };
      if (amAssignment) updateData.contact_profile_id = amAssignment.user_id;
      if (spocAssignment) updateData.spoc_profile_id = spocAssignment.user_id;
      if (amAssignment || spocAssignment) {
        await tx.demands.update({ where: { id: demandId }, data: updateData });
      }
      if (spocAssignment && spocAssignment.user_id !== previousAssignment.spocId) {
        await tx.demand_assignment_events.create({
          data: {
            demand_id: demandId,
            category: 'costaff_spoc',
            action: 'assign',
            subject_id: spocAssignment.user_id,
            created_by: currentUser.userId,
          },
        });
      }

      if (clearRoleSet.has('spoc') && !spocAssignment && previousAssignment.spocId) {
        await tx.demand_assignments.updateMany({
          where: { demand_id: demandId, role_in_demand: 'spoc', is_active: true },
          data: { is_active: false, remark: remark || 'Unassigned' },
        });
        await tx.demands.update({
          where: { id: demandId },
          data: { spoc_profile_id: null, updated_by: currentUser.userId },
        });
        await tx.demand_assignment_events.create({
          data: {
            demand_id: demandId,
            category: 'costaff_spoc',
            action: 'unassign',
            subject_id: previousAssignment.spocId,
            created_by: currentUser.userId,
          },
        });
      }

      if (clearRoleSet.has('account_manager') && !amAssignment && currentUser.role === 'super_admin') {
        await tx.demand_assignments.updateMany({
          where: { demand_id: demandId, role_in_demand: 'account_manager', is_active: true },
          data: { is_active: false, remark: remark || 'Unassigned' },
        });
        await tx.demands.update({
          where: { id: demandId },
          data: { contact_profile_id: null, updated_by: currentUser.userId },
        });
        await tx.demand_assignment_events.create({
          data: {
            demand_id: demandId,
            category: 'account_manager',
            action: 'unassign',
            subject_id: previousAssignment.recruiterIds ? null : null,
            created_by: currentUser.userId,
          },
        });
      }

      // Recruiters are replaced only when this call is about recruiters. A SPOC-only
      // save must not wipe the TA list. An explicit clear, or a recruiter list (including
      // empty when clear_roles includes recruiter), replaces the set.
      const recruitersAddressed = recruiterAssignments.length > 0 || clearRoleSet.has('recruiter');
      if (recruitersAddressed) {
        const previousRecruiters = new Set(previousAssignment.recruiterIds);
        const nextRecruiters = new Set(recruiterAssignments.map((a) => a.user_id));
        await tx.demand_ta_allocations.deleteMany({ where: { demand_id: demandId } });
        if (recruiterAssignments.length > 0) {
          await tx.demand_ta_allocations.createMany({
            data: recruiterAssignments.map((a) => ({ demand_id: demandId, ta_id: a.user_id })),
            skipDuplicates: true,
          });
        }
        const events = [
          ...[...previousRecruiters].filter((id) => !nextRecruiters.has(id)).map((id) => ({
            demand_id: demandId,
            category: 'recruiter',
            action: 'unassign',
            subject_id: id,
            created_by: currentUser.userId,
          })),
          ...[...nextRecruiters].filter((id) => !previousRecruiters.has(id)).map((id) => ({
            demand_id: demandId,
            category: 'recruiter',
            action: 'assign',
            subject_id: id,
            created_by: currentUser.userId,
          })),
        ];
        if (events.length > 0) await tx.demand_assignment_events.createMany({ data: events });
      }

      if (clientSpocIds) {
        const current = await tx.demands.findUnique({ where: { id: demandId }, select: { client_spoc_ids: true } });
        const previousIds = new Set(current?.client_spoc_ids ?? []);
        const nextIds = new Set(clientSpocIds);
        await tx.demands.update({
          where: { id: demandId },
          data: { client_spoc_ids: clientSpocIds, updated_by: currentUser.userId },
        });
        const events = [
          ...[...previousIds].filter((id) => !nextIds.has(id)).map((id) => ({
            demand_id: demandId,
            category: 'client_spoc',
            action: 'unassign',
            subject_id: id,
            created_by: currentUser.userId,
          })),
          ...[...nextIds].filter((id) => !previousIds.has(id)).map((id) => ({
            demand_id: demandId,
            category: 'client_spoc',
            action: 'assign',
            subject_id: id,
            created_by: currentUser.userId,
          })),
        ];
        if (events.length > 0) await tx.demand_assignment_events.createMany({ data: events });
      }

      // In-app notifications for newly-assigned SPOC / recruiter(s), inside the same
      // transaction as the assignment itself. Users who were already assigned get nothing, so
      // re-submitting an unchanged assignment is a no-op (spec §5, §7). An AM/SPOC entry
      // absent from the payload leaves that slot unchanged, so it contributes no notification.
      const notificationsCreated = await notifyNewlyAssigned(tx, {
        demandId,
        requestId: demandRow?.request_id ?? requestId,
        jobTitle: demandRow?.job_title ?? demandRow?.skill_description,
        previous: previousAssignment,
        next: {
          spocId: clearRoleSet.has('spoc') && !spocAssignment ? null : (spocAssignment?.user_id ?? previousAssignment.spocId),
          recruiterIds: recruiterAssignments.length > 0 || clearRoleSet.has('recruiter')
            ? recruiterAssignments.map((a) => a.user_id)
            : previousAssignment.recruiterIds,
        },
        actorId: currentUser.userId,
      });

      return { count: created.count, notificationsCreated };
    });

    return NextResponse.json({ success: true, count: result.count, notificationsCreated: result.notificationsCreated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/demands/[requestId]/assign:', error);
    return NextResponse.json({ error: 'Failed to assign demand' }, { status: 500 });
  }
}
