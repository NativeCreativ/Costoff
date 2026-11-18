'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DemandForm } from './DemandForm';
import { DemandFormValues } from './demand.schema';
import { AddClientDrawer } from '@/components/companies/AddClientDrawer';

export type DemandFormState = DemandFormValues;

interface DemandFormModalProps {
  demandForm: DemandFormState;
  setDemandForm: (v: DemandFormState) => void;
  setShowDemandModal: (v: boolean) => void;
  handleCreateDemand: (values: DemandFormState) => void;
  isSubmitting?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  /** Set only when this form was opened via Clone Demand — pre-filled from, and
   *  editable before creating, a new Demand linked back to this source Request ID.
   *  Changes the title/subtitle/notice only; the form, the endpoint and the validation
   *  are identical to a normal create. */
  cloningFromRequestId?: string | null;
  /** Display names for the cloned AM/SPOC/Recruiters, known from the source demand —
   *  same reason as DemandEditModal's equivalents: the profile-list queries can be slow,
   *  and until they resolve the selects would show nothing for an already-set value. */
  initialAmLabel?: string;
  initialSpocLabel?: string;
  initialRecruiterOptions?: { id: string; name: string }[];
  /** Create mode: display name of the company pre-selected (e.g. inherited from a clone),
   *  so the Company trigger isn't blank while the company list loads. */
  initialCompanyLabel?: string;
}

export function DemandFormModal({
  demandForm,
  setDemandForm,
  setShowDemandModal,
  handleCreateDemand,
  isSubmitting,
  currentUserId,
  currentUserRole,
  cloningFromRequestId,
  initialAmLabel,
  initialSpocLabel,
  initialRecruiterOptions,
  initialCompanyLabel,
}: DemandFormModalProps) {
  const isClone = !!cloningFromRequestId;
  const [showAddClientDrawer, setShowAddClientDrawer] = useState(false);
  const [savedCompany, setSavedCompany] = useState<{ id: string; name: string; client_name?: string | null } | null>(null);
  const [preserveRoundsOnNextCompanyChange, setPreserveRoundsOnNextCompanyChange] = useState(false);
  const [clientLockedByDrawer, setClientLockedByDrawer] = useState(false);

  const handleOpenAddClientDrawer = () => {
    setShowAddClientDrawer(true);
  };

  const handleClientSaved = (company: { id: string; name: string; client_name?: string | null }) => {
    setSavedCompany(company);
    // Rule: lock the Client select only after a successful drawer save.
    setClientLockedByDrawer(true);
    setPreserveRoundsOnNextCompanyChange(true);
    setDemandForm({
      ...demandForm,
      company_id: company.id,
    });
    setTimeout(() => setPreserveRoundsOnNextCompanyChange(false), 0);
  };

  const handleDrawerClose = () => {
    setShowAddClientDrawer(false);
  };

  return (
    <Modal
      title={isClone ? `Clone Demand — from ${cloningFromRequestId}` : 'Add New Demand'}
      subtitle={isClone ? 'Review and edit before creating — this will get its own new Requirement ID and a fresh pipeline.' : 'Enter structured client requirement details'}
      size="large"
      onClose={() => {
        if (showAddClientDrawer) {
          handleDrawerClose();
        } else {
          setShowDemandModal(false);
        }
      }}
      closeDisabled={isSubmitting || showAddClientDrawer}
      lockContentScroll={showAddClientDrawer}
    >
      {isClone && (
        <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-[#e0e7ff] bg-[#eef2ff] px-3.5 py-3">
          <Copy className="mt-0.5 h-4 w-4 shrink-0 text-[#4338ca]" />
          <div className="text-[0.8rem] leading-relaxed text-[#3730a3]">
            <div className="font-bold">Cloned from {cloningFromRequestId}</div>
            <div className="mt-0.5">
              Every field below is pre-filled and fully editable — change the customer,
              ownership, positions or compensation before saving. The clone starts a brand
              new requirement with its own Requirement ID and a fresh lifecycle: it does not
              inherit the candidates, interviews or history of {cloningFromRequestId}.
            </div>
          </div>
        </div>
      )}
      <DemandForm
        defaultValues={demandForm}
        onSubmit={(values) => { setDemandForm(values); handleCreateDemand(values); }}
        onCancel={() => setShowDemandModal(false)}
        submitLabel={isClone ? 'Create Cloned Demand' : 'Submit Demand'}
        secondaryAction={isClone ? undefined : { label: 'Save as draft', values: { is_draft: true } }}
        pendingLabel="Creating…"
        isSubmitting={isSubmitting}
        idFieldsReadOnlyPlaceholders
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        initialAmLabel={initialAmLabel}
        initialSpocLabel={initialSpocLabel}
        initialRecruiterOptions={initialRecruiterOptions}
        initialCompanyLabel={savedCompany?.client_name || savedCompany?.name || initialCompanyLabel}
        onQuickCreate={handleOpenAddClientDrawer}
        clientLockedByDrawer={clientLockedByDrawer}
        demandAccountManagerId={demandForm.contact_profile_id}
        preserveRoundsOnNextCompanyChange={preserveRoundsOnNextCompanyChange}
      />
      <AddClientDrawer
        isOpen={showAddClientDrawer}
        onClose={handleDrawerClose}
        demandAccountManagerId={demandForm.contact_profile_id}
        onCompanySaved={handleClientSaved}
        currentUserRole={currentUserRole}
      />
    </Modal>
  );
}
