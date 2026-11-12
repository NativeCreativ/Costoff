'use client';

import { Demand } from '../types';
import { DemandFormState } from './DemandFormModal';
import { Modal } from '@/components/ui/Modal';
import { DemandForm } from './DemandForm';

interface DemandEditModalProps {
  editingDemand: Demand;
  demandForm: DemandFormState;
  setDemandForm: (v: DemandFormState) => void;
  setShowEditDemandModal: (v: boolean) => void;
  setEditingDemand: (v: Demand | null) => void;
  handleUpdateDemand: (values: DemandFormState) => void;
  isSubmitting?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

export function DemandEditModal({ editingDemand, demandForm, setDemandForm, setShowEditDemandModal, setEditingDemand, handleUpdateDemand, isSubmitting, currentUserId, currentUserRole }: DemandEditModalProps) {
  const close = () => { setShowEditDemandModal(false); setEditingDemand(null); };
  return (
    <Modal title={`Edit Demand — ${editingDemand.request_id}`} subtitle="Update requirement details, status, priority, and allocation" size="large" onClose={close} closeDisabled={isSubmitting}>
      <DemandForm
        defaultValues={demandForm}
        onSubmit={(values) => { setDemandForm(values); handleUpdateDemand(values); }}
        onCancel={close}
        submitLabel="Save Changes"
        pendingLabel="Saving…"
        isSubmitting={isSubmitting}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        initialAmLabel={editingDemand.am_name}
        initialSpocLabel={editingDemand.spoc_name}
        initialRecruiterOptions={(editingDemand.recruiter_ids ?? []).map((id, i) => ({
          id,
          name: editingDemand.recruiter_names?.[i] || id,
        }))}
        editingDemand={editingDemand}
        initialCompanyLabel={editingDemand.company_name || editingDemand.client_name}
      />
    </Modal>
  );
}
