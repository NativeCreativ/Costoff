'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { UserSelect } from '@/components/ui/UserSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientSpocItemSchema, type ClientSpocItem } from '@/components/masterData/spoc.schema';
import { useAddCompanySpocMutation, useCompanySpocsQuery } from '@/queries/companies/useCompanySpocs';

interface ClientSpocFieldProps {
  companyId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

const EMPTY_SPOC: ClientSpocItem = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  vertical: '',
  supervisor: '',
  supervisor_designation: '',
};

/**
 * "Select SPOC" / "Add SPOC" for the client's own contacts (company_spocs), stored on the demand
 * as client_spoc_ids. Only active SPOCs are offered; one the demand already has stays shown
 * (tagged Inactive) after it is deactivated, so it is never silently dropped on save.
 * "Add SPOC" saves the new contact to the client right away and selects it here.
 */
export function ClientSpocField({ companyId, value, onChange, disabled }: ClientSpocFieldProps) {
  const spocsQuery = useCompanySpocsQuery(companyId || null);
  const addSpoc = useAddCompanySpocMutation(companyId || null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ClientSpocItem>(EMPTY_SPOC);
  const [draftError, setDraftError] = useState<string | null>(null);

  const spocs = spocsQuery.data ?? [];
  const options = spocs
    .filter((spoc) => spoc.id && (spoc.is_active !== false || value.includes(spoc.id)))
    .map((spoc) => ({
      id: spoc.id as string,
      name: spoc.name,
      email: [spoc.designation, spoc.vertical, spoc.email].filter(Boolean).join(' · ') || undefined,
      role: spoc.is_active === false ? 'Inactive' : undefined,
    }));

  const saveDraft = () => {
    const parsed = clientSpocItemSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? 'Check the SPOC details');
      return;
    }
    setDraftError(null);
    addSpoc.mutate(parsed.data, {
      onSuccess: (spoc) => {
        if (spoc.id) onChange([...value, spoc.id]);
        setDraft(EMPTY_SPOC);
        setAdding(false);
      },
    });
  };

  const setField = (field: keyof ClientSpocItem) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  if (!companyId) {
    return (
      <div>
        <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">Client SPOCs</div>
        <p className="text-[0.75rem] text-[#94a3b8]">Pick a client to choose or add its SPOCs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <UserSelect
            mode="multiple"
            label="Client SPOCs"
            placeholder={spocs.length === 0 && !spocsQuery.isLoading ? 'No SPOCs yet. Add one.' : 'Select client SPOCs'}
            options={options}
            value={value}
            onChange={onChange}
            isLoading={spocsQuery.isLoading}
            disabled={disabled}
          />
        </div>
        {!disabled && !adding && (
          <Button type="button" variant="outline" size="sm" className="mb-[1px] h-9 gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add SPOC
          </Button>
        )}
      </div>
      {spocsQuery.isError && <p className="text-[0.72rem] text-[#dc2626]">Couldn&apos;t load this client&apos;s SPOCs.</p>}
      {adding && (
        <div className="flex flex-col gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
          <div className="text-[0.72rem] font-semibold text-[#475569]">New SPOC — saved to this client and selected here</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input className="h-9 bg-white" placeholder="Name *" value={draft.name} onChange={setField('name')} />
            <Input className="h-9 bg-white" placeholder="Email" value={draft.email ?? ''} onChange={setField('email')} />
            <Input className="h-9 bg-white" placeholder="Phone" value={draft.phone ?? ''} onChange={setField('phone')} />
            <Input className="h-9 bg-white" placeholder="Designation" value={draft.designation ?? ''} onChange={setField('designation')} />
            <Input className="h-9 bg-white" placeholder="Vertical" value={draft.vertical ?? ''} onChange={setField('vertical')} />
            <Input className="h-9 bg-white" placeholder="Supervisor" value={draft.supervisor ?? ''} onChange={setField('supervisor')} />
            <Input className="h-9 bg-white" placeholder="Supervisor designation" value={draft.supervisor_designation ?? ''} onChange={setField('supervisor_designation')} />
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-9" disabled={addSpoc.isPending} onClick={saveDraft}>
                {addSpoc.isPending ? 'Saving…' : 'Save SPOC'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={addSpoc.isPending}
                onClick={() => {
                  setAdding(false);
                  setDraft(EMPTY_SPOC);
                  setDraftError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {draftError && <p className="text-[0.72rem] text-[#dc2626]">{draftError}</p>}
        </div>
      )}
    </div>
  );
}
