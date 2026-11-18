'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, setPage, setPageSize, setSearch, LISTS } from '@/features/listState/listStateSlice';
import { demandDetailHref } from '@/lib/demandFulfillment/routes';
import { canCreateDemand, canEditDemand, canDeleteDemand, DEMAND_DELETE_BLOCKED_MESSAGE } from '@/lib/auth/demandPermissions';
import { buildDemandCloneForm, canCloneDemandAction } from '@/lib/demands/demandClone';
import { useToast } from '@/components/ui/Toast';
import { useDemandsQuery } from '@/queries/demands/useDemandsQuery';
import {
  useCreateDemandMutation,
  useUpdateDemandMutation,
  useDeleteDemandMutation,
} from '@/queries/demands/useDemandMutations';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { DemandsView } from '@/components/demands/DemandsView';
import { DemandFormModal, type DemandFormState } from '@/components/demands/DemandFormModal';
import { DemandEditModal } from '@/components/demands/DemandEditModal';
import { DemandDeleteConfirmModal } from '@/components/demands/DemandDeleteConfirmModal';
import type { Demand } from '@/components/types';
import { toDemandCertifications, toFormWorkModes } from '@/components/demands/demand.schema';

const emptyDemandForm: DemandFormState = {
  request_id: '', company_id: '', end_client_id: '', demand_type: '', job_title: '', skill_description: '',
  role_category: 'Full Time', priority: 'High', status: 'Open',
  engagement_type: '', client_demand_id: '', intermediary_partner: '', shift_timings: '', comments: '', other_details: '', customer_jd: '',
  customer_jd_file_url: '', customer_jd_file_name: '', client_spoc_ids: [],
  total_experience: '', relevant_experience: '', certifications: [],
  experience_levels: [], required_skills: [], skills_category_id: '', work_modes: ['Work On Site'],
  compensation_currency_id: '', compensation_type_id: '', compensation_min: '', compensation_max: '',
  locations: [], num_positions: 1,
  contact_profile_id: '',
  spoc_profile_id: '', recruiter_ids: [],
};

/** /demands — the Demands / Requirements list. Drilling into a demand goes to /demands/[requestId]. */
export default function DemandsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const list = useAppSelector((state) => state.listState[LISTS.demands]);
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [showDemandModal, setShowDemandModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [showEditDemandModal, setShowEditDemandModal] = useState(false);
  const [deletingDemand, setDeletingDemand] = useState<Demand | null>(null);
  const [demandForm, setDemandForm] = useState<DemandFormState>(emptyDemandForm);
  // Set only while showDemandModal is open via Clone Demand (never alongside a normal
  // create) — the source demand's id (sent to the backend for re-validation + the audit
  // trail), its request_id (shown in the modal's title) and its display names, so the
  // AM/SPOC/Recruiter selects can render labels immediately.
  const [cloningFrom, setCloningFrom] = useState<{
    id: string;
    request_id: string;
    am_name?: string;
    spoc_name?: string;
    company_name?: string;
    recruiter_ids: string[];
    recruiter_names: string[];
  } | null>(null);

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.demands, key, value: v }));
  const redFlagsOnly = filter('redFlagsOnly') === 'true';
  // "My demands" (Recruiters): they may browse every demand, but the list opens on the ones
  // assigned to them. '' = not chosen yet → the role default; 'mine' / 'all' = the user's pick.
  const showAssignedToMeToggle = currentUser?.role === 'ta';
  const scopeFilter = filter('scope');
  const assignedToMe = showAssignedToMeToggle && (scopeFilter === 'mine' || scopeFilter === '');

  const demandsQuery = useDemandsQuery({
    search: list.search,
    status: filter('status'),
    priority: filter('priority'),
    roleType: filter('roleType'),
    redFlagsOnly,
    assignedToMe,
    page: list.page,
    pageSize: list.pageSize,
  });

  const createDemandMutation = useCreateDemandMutation();
  const updateDemandMutation = useUpdateDemandMutation();
  const deleteDemandMutation = useDeleteDemandMutation();

  const canManageDemands = canCreateDemand(currentUser?.role);

  const getDemandPermissions = (item: Demand) => {
    const actor = { role: currentUser?.role, id: currentUser?.id };
    const canEdit = canEditDemand(actor, item);
    const canDelete = canDeleteDemand(actor, item);
    const deleteDisabledReason = canEdit && !canDelete
      ? DEMAND_DELETE_BLOCKED_MESSAGE
      : !canEdit
      ? 'You can only delete Demands you own'
      : undefined;
    // Clone is offered on every Demand the user may edit, in ANY status — once a demand exists,
    // its configuration is reusable as the starting point for another requirement (the same
    // company routinely needs several similar demands). Visibility follows the same ownership
    // rule as Edit; the backend re-enforces ownership and the ACTIVE-company rule independently.
    const { canShow: canClone } = canCloneDemandAction(item, canEdit);
    return { canEdit, canDelete, canClone, deleteDisabledReason };
  };

  const handleOpenCreateDemand = () => {
    setCloningFrom(null);
    setDemandForm({
      ...emptyDemandForm,
      // AM's own ownership: the Account Manager selector is hidden for them, so seed
      // contact_profile_id with their own id up front (Super Admin picks explicitly).
      contact_profile_id: currentUser?.role === 'account_manager' ? currentUser.id : '',
    });
    setShowDemandModal(true);
  };

  // Clone Demand — opens the SAME Create Demand form pre-filled from the source demand
  // (client/company, role details, skills, compensation, positions and the
  // AM/SPOC/Recruiter team), fully editable before creation. Works in ANY status. The mapping
  // itself — what is copied and what is deliberately reset — lives in buildDemandCloneForm
  // (src/lib/demands/demandClone.ts) so the list and detail pages can't drift apart.
  //
  // If the source's Company has since gone INACTIVE it will not be offered by the form's
  // ACTIVE-only dropdown, and the API would reject it — the user must pick or reactivate an
  // active company before saving. That is the same rule a manually created demand obeys.
  const handleCloneDemand = (item: Demand) => {
    setCloningFrom({
      id: item.id,
      request_id: item.request_id,
      am_name: item.am_name,
      spoc_name: item.spoc_name,
      company_name: item.company_name,
      recruiter_ids: item.recruiter_ids ?? [],
      recruiter_names: item.recruiter_names ?? [],
    });
    setDemandForm(buildDemandCloneForm(item));
    setShowDemandModal(true);
  };

  const handleCreateDemand = (values: DemandFormState) => {
    createDemandMutation.mutate(
      { form: values, clonedFromDemandId: cloningFrom?.id },
      {
        onSuccess: (created) => {
          setShowDemandModal(false);
          setDemandForm(emptyDemandForm);
          const wasCloning = !!cloningFrom;
          setCloningFrom(null);
          if (wasCloning) router.push(demandDetailHref(created.request_id));
        },
        onError: (err: any) => {
          console.error('Error creating demand:', err);
          const msg = err?.response?.data?.error || err?.message || 'Failed to create demand';
          toast.error('Create Failed', msg);
        },
      },
    );
  };

  const handleEditDemand = (item: Demand) => {
    setEditingDemand(item);
    setDemandForm({
      request_id: item.request_id || '',
      company_id: item.company_id || '',
      end_client_id: item.end_client_id || '',
      demand_type: item.demand_type || '',
      job_title: item.job_title || '',
      skill_description: item.skill_description || '',
      role_category: (item.role_category || 'Full Time') as DemandFormState['role_category'],
      priority: (item.priority || 'High') as DemandFormState['priority'],
      status: (item.status || 'Open') as DemandFormState['status'],
      engagement_type: item.engagement_type || '',
      client_demand_id: item.client_demand_id || '',
      intermediary_partner: item.intermediary_partner || '',
      shift_timings: item.shift_timings || '',
      comments: item.comments || '',
      other_details: item.other_details || '',
      customer_jd: item.customer_jd || '',
      customer_jd_file_url: item.customer_jd_file_url || '',
      customer_jd_file_name: item.customer_jd_file_name || '',
      client_spoc_ids: Array.isArray(item.client_spoc_ids) ? item.client_spoc_ids : [],
      total_experience: item.total_experience || '',
      relevant_experience: item.relevant_experience || '',
      certifications: toDemandCertifications(item.certifications),
      experience_levels: Array.isArray(item.experience_levels) ? item.experience_levels : [],
      required_skills: Array.isArray(item.technology_stack) ? item.technology_stack : [],
      // Blank when no category was ever picked, or when it was deleted/deactivated since.
      skills_category_id: item.skills_category_id || '',
      work_modes: toFormWorkModes(item),
      compensation_currency_id: item.compensation_currency_id || '',
      compensation_type_id: item.compensation_type_id || '',
      // Free-text bounds, pre-filled exactly as stored.
      compensation_min: item.compensation_min ?? '',
      compensation_max: item.compensation_max ?? '',
      locations: Array.isArray(item.locations) ? item.locations : [],
      num_positions: item.num_positions || 1,
      contact_profile_id: item.contact_profile_id || '',
      spoc_profile_id: item.spoc_profile_id || '',
      recruiter_ids: Array.isArray(item.recruiter_ids) ? item.recruiter_ids : [],
    });
    setShowEditDemandModal(true);
  };

  const handleUpdateDemand = (values: DemandFormState) => {
    if (!editingDemand) return;
    updateDemandMutation.mutate(
      { id: editingDemand.id, form: values },
      {
        onSuccess: () => {
          setShowEditDemandModal(false);
          setEditingDemand(null);
          setDemandForm(emptyDemandForm);
        },
        onError: (err: any) => {
          console.error('Error updating demand:', err);
          const msg = err?.response?.data?.error || err?.message || 'Failed to update demand';
          // A round blocked because this demand already has interviews against it is a specific,
          // actionable outcome, not a generic failure — title it accordingly. The message already
          // names the round. The modal stays open with everything the user typed.
          toast.error(err?.response?.data?.code === 'ROUND_IN_USE' ? 'Round In Use' : 'Update Failed', msg);
        },
      },
    );
  };

  return (
    <>
      <DemandsView
        demands={demandsQuery.data?.data ?? []}
        loadingDemands={demandsQuery.isLoading}
        isFetching={demandsQuery.isFetching}
        total={demandsQuery.data?.total ?? 0}
        totalPages={demandsQuery.data?.totalPages ?? 1}
        page={list.page}
        onPageChange={(page: number) => dispatch(setPage({ list: LISTS.demands, page }))}
        pageSize={list.pageSize}
        onPageSizeChange={(pageSize: number) => dispatch(setPageSize({ list: LISTS.demands, pageSize }))}
        demandSearch={list.search}
        setDemandSearch={(v: string) => dispatch(setSearch({ list: LISTS.demands, value: v }))}
        statusFilter={filter('status')}
        setStatusFilter={setFilterValue('status')}
        priorityFilter={filter('priority')}
        setPriorityFilter={setFilterValue('priority')}
        roleTypeFilter={filter('roleType')}
        setRoleTypeFilter={setFilterValue('roleType')}
        redFlagsOnly={redFlagsOnly}
        setRedFlagsOnly={(v: boolean) => dispatch(setFilter({ list: LISTS.demands, key: 'redFlagsOnly', value: String(v) }))}
        showAssignedToMeToggle={showAssignedToMeToggle}
        assignedToMe={assignedToMe}
        setAssignedToMe={(v: boolean) => dispatch(setFilter({ list: LISTS.demands, key: 'scope', value: v ? 'mine' : 'all' }))}
        setShowDemandModal={(v) => (v ? handleOpenCreateDemand() : setShowDemandModal(false))}
        canManageDemands={canManageDemands}
        canManageDemandsLoading={currentUserQuery.isLoading}
        canBulkChangeStatus={currentUser?.role === 'account_manager' || isSuperAdmin}
        getDemandPermissions={getDemandPermissions}
        openLifecycle={(reqId: string) => router.push(demandDetailHref(reqId))}
        onEdit={handleEditDemand}
        onDeleteRequest={(item) => setDeletingDemand(item)}
        onCloneRequest={handleCloneDemand}
      />

      {showDemandModal && (
        <DemandFormModal
          demandForm={demandForm}
          setDemandForm={setDemandForm}
          setShowDemandModal={(v) => { setShowDemandModal(v); if (!v) setCloningFrom(null); }}
          handleCreateDemand={handleCreateDemand}
          isSubmitting={createDemandMutation.isPending}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
          cloningFromRequestId={cloningFrom?.request_id}
          initialAmLabel={cloningFrom?.am_name}
          initialSpocLabel={cloningFrom?.spoc_name}
          initialRecruiterOptions={(cloningFrom?.recruiter_ids ?? []).map((id, i) => ({
            id,
            name: cloningFrom?.recruiter_names?.[i] || id,
          }))}
          initialCompanyLabel={cloningFrom?.company_name || cloningFrom?.am_name}
        />
      )}

      {showEditDemandModal && editingDemand && (
        <DemandEditModal
          editingDemand={editingDemand}
          demandForm={demandForm}
          setDemandForm={setDemandForm}
          setShowEditDemandModal={setShowEditDemandModal}
          setEditingDemand={setEditingDemand}
          handleUpdateDemand={handleUpdateDemand}
          isSubmitting={updateDemandMutation.isPending}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
        />
      )}

      {deletingDemand && (
        <DemandDeleteConfirmModal
          deletingDemand={deletingDemand}
          onCancel={() => setDeletingDemand(null)}
          onConfirm={(id: string) =>
            deleteDemandMutation.mutate(id, {
              onSuccess: () => setDeletingDemand(null),
              onError: (err: any) => {
                console.error('Error deleting demand:', err);
                const msg = err?.response?.data?.error || err?.message || 'Failed to delete demand';
                toast.error('Delete Failed', msg);
              },
            })
          }
          isDeleting={deleteDemandMutation.isPending}
        />
      )}
    </>
  );
}
