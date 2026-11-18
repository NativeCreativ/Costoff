'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CompanyForm, type CompanyFormValues } from '@/components/companies/CompanyForm';
import {
  useCreateCompanyMutation,
  useUpdateCompanyMutation,
  useUpdateCompanyRoundsMutation,
} from '@/queries/companies/useCompanyMutations';
import { getCompany, getCompanyInterviewRounds } from '@/services/company.service';
import { queryKeys } from '@/lib/queryKeys';
import { companyFormValuesToPayload, companyRoundsToPayload, companyRoundsFingerprint } from '@/lib/companies/companyFormPayload';
import type { ConfiguredRound } from '@/services/interviewRound.service';
import type { Company, ClientSpoc as CompanySpoc } from '@/components/types';

const EMPTY_FORM: CompanyFormValues = {
  name: '', email: '', phone: '', website: '',
  address: '', city: '', state: '', country: '', other_details: '', status: 'ACTIVE', spocs: [],
};

const toStatus = (value?: string | null): CompanyFormValues['status'] =>
  value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

/** Company Create/Edit modal. Persists the company and its round configuration together. */
export function CompanyFormModal({
  mode,
  editingCompany,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  editingCompany?: Company | null;
  onClose: () => void;
  onSaved?: (company: Company) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['company', editingCompany?.id],
    queryFn: () => getCompany(editingCompany!.id),
    enabled: mode === 'edit' && !!editingCompany?.id,
    staleTime: 30 * 1000,
  });

  const roundsQuery = useQuery({
    queryKey: ['company-interview-rounds', editingCompany?.id],
    queryFn: () => getCompanyInterviewRounds(editingCompany!.id),
    enabled: mode === 'edit' && !!editingCompany?.id,
    staleTime: 30 * 1000,
  });

  const createMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateCompanyMutation();
  const updateRoundsMutation = useUpdateCompanyRoundsMutation();
  const isPending = createMutation.isPending || updateMutation.isPending || updateRoundsMutation.isPending;

  const company = detailQuery.data;
  const initialRounds: ConfiguredRound[] = (roundsQuery.data?.rounds ?? []).map((r) => ({
    round_id: r.round_id,
    name: r.name,
    mode: r.mode,
    order: r.order,
    mandatory: r.mandatory,
    isActive: r.isActive,
    usage: r.usage,
  }));

  // The row id travels with each SPOC so saving updates the same company_spocs rows that
  // demands reference (demands.client_spoc_ids), instead of recreating them.
  const spocsOf = (source?: { company_spocs?: CompanySpoc[] } | null) =>
    (source?.company_spocs ?? []).map((spoc) => ({
      id: spoc.id,
      name: spoc.name,
      email: spoc.email || '',
      phone: spoc.phone || '',
      designation: spoc.designation || '',
      vertical: spoc.vertical || '',
      supervisor: spoc.supervisor || '',
      supervisor_designation: spoc.supervisor_designation || '',
      is_active: spoc.is_active !== false,
    }));

  const defaultValues: CompanyFormValues = company
    ? {
        name: company.client_name || company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        country: company.country || '',
        other_details: company.other_details || '',
        status: toStatus(company.status),
        spocs: spocsOf(company),
      }
    : mode === 'edit' && editingCompany
    ? {
        name: editingCompany.client_name || editingCompany.name || '',
        email: editingCompany.email || '',
        phone: editingCompany.phone || '',
        website: editingCompany.website || '',
        address: editingCompany.address || '',
        city: editingCompany.city || '',
        state: editingCompany.state || '',
        country: editingCompany.country || '',
        other_details: editingCompany.other_details || '',
        status: toStatus(editingCompany.status),
        spocs: spocsOf(editingCompany),
      }
    : EMPTY_FORM;

  const handleSubmit = (values: CompanyFormValues, rounds: ConfiguredRound[]) => {
    setError(null);
    const payload = companyFormValuesToPayload(values);
    const errMsg = (e: unknown) =>
      isAxiosError(e) ? e.response?.data?.error || 'Failed to save company' : 'Failed to save company';

    const roundPayload = companyRoundsToPayload(rounds);

    // Edit Company: only send rounds when the list actually differs from what is stored.
    // "Unchanged" must stay indistinguishable from "never touched", so a plain phone-number
    // edit can never be read as an instruction to wipe or rewrite the company's rounds.
    const roundsChanged = companyRoundsFingerprint(roundPayload) !== companyRoundsFingerprint(initialRounds);

    // Clearing is the one destructive edit here, so it is confirmed rather than implicit. A
    // round already in use by one of this company's demands (or a candidate interview) still
    // blocks the clear server-side — the demand keeps its own copy of the round either way.
    if (mode === 'edit' && roundsChanged && roundPayload.length === 0 && initialRounds.length > 0) {
      const confirmed = window.confirm(
        `Remove all interview rounds from this company? New demands will no longer inherit any rounds from it. Rounds already in use by a demand or interview may block this.`
      );
      if (!confirmed) return;
    }

    if (mode === 'create') {
      // Add Company: the company and its optional initial rounds are saved in ONE request, so a
      // rejected round can never leave a company behind that has none of what the user typed.
      createMutation.mutate(
        {
          ...payload,
          ...(roundPayload.length > 0 ? { interview_rounds: roundPayload } : {}),
        },
        {
          onSuccess: (created) => {
            toast.success('Client created', `"${created.name}" is now available on the Demand form.`);
            onSaved?.(created);
            onClose();
          },
          onError: (e) => {
          // A duplicate is a normal, expected outcome — say so plainly instead of silently
          // reusing the existing record as the previous version of this endpoint did.
          if (isAxiosError(e) && e.response?.status === 409) {
            const msg = (e.response.data?.error as string) || 'A company with that name already exists.';
            setError(msg);
            toast.error('Client not created', msg);
            return;
          }
          const msg = errMsg(e);
          setError(msg);
          toast.error('Company not created', msg);
        },
      });
      return;
    }

    updateMutation.mutate(
      { id: editingCompany!.id, form: payload },
      {
        onSuccess: ({ company, syncedDemands }) => {
          // Renaming/contacting a company re-propagates its denormalized copy onto every
          // linked demand; refresh those lists too so nothing on screen shows a stale name.
          queryClient.invalidateQueries({ queryKey: ['demands'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });

          if (!roundsChanged) {
            toast.success(
              'Client updated',
              syncedDemands
                ? `Changes saved and synced to ${syncedDemands} linked demand${syncedDemands === 1 ? '' : 's'}.`
                : 'Changes saved.'
            );
            onSaved?.(company);
            onClose();
            return;
          }
          // Edit Company is the one place existing company rounds may change — add, remove,
          // rename, reorder, toggle Mandatory, or clear the whole list. Only NEW demands inherit
          // the change; demands that already exist keep the rounds they were created with.
          updateRoundsMutation.mutate(
            { id: company.id, rounds: roundPayload },
            {
              onSuccess: () => {
                toast.success('Company updated', `"${company.name}" saved with its interview rounds.`);
                onSaved?.(company);
                onClose();
              },
              onError: (e) => {
                // Most commonly the in-use guard (409 ROUND_IN_USE). The form stays open with
                // everything the user typed, so the round that blocked it can be dealt with.
                const msg = errMsg(e);
                setError(msg);
                toast.error('Rounds not saved', msg);
              },
            }
          );
        },
        onError: (e) => {
          const msg = isAxiosError(e) && e.response?.status === 409
            ? (e.response.data?.error as string) || 'A company with that name already exists.'
            : errMsg(e);
          setError(msg);
            toast.error('Client not updated', msg);
        },
      }
    );
  };

  const loading = mode === 'edit' && !!editingCompany?.id && (detailQuery.isLoading || roundsQuery.isLoading);

  return (
    <Modal
      title={mode === 'create' ? 'Add New Client' : `Edit Client — ${editingCompany?.name ?? ''}`}
      subtitle={
        mode === 'create'
          ? 'Client name, contact details, SPOCs and the interview template.'
          : 'Update the client, its SPOCs and its interview template.'
      }
      size="large"
      onClose={onClose}
      closeDisabled={isPending}
    >
      {loading ? (
        <Loader message="Loading company…" />
      ) : (
        <>
          {/* Error banner sits ABOVE the form, not below it. The previous version rendered it
              under a long scrollable form, so a failed save was effectively invisible unless
              the user scrolled to the very bottom — which is why failures looked like they
              "silently did nothing". A toast fires as well, so the reason is unmissable. */}
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2.5 text-[0.8rem] font-medium text-[#dc2626]"
            >
              <span className="mt-px shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}
          <CompanyForm
            defaultValues={defaultValues}
            initialRounds={initialRounds}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel={mode === 'create' ? 'Save Client' : 'Save Changes'}
            pendingLabel="Saving…"
            isSubmitting={isPending}
            onValidationError={(message) => {
              setError(message);
              toast.error('Please fix the highlighted fields', message);
            }}
          />
        </>
      )}
    </Modal>
  );
}

/** Read-only Company detail. */
export function CompanyViewModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ['company', company.id],
    queryFn: () => getCompany(company.id),
    staleTime: 30 * 1000,
  });
  const roundsQuery = useQuery({
    queryKey: ['company-interview-rounds', company.id],
    queryFn: () => getCompanyInterviewRounds(company.id),
    staleTime: 30 * 1000,
  });

  const c = detailQuery.data ?? company;
  const linkedDemands = detailQuery.data?._count?.demands ?? company._count?.demands ?? 0;

  const sections: { title: string; rows: [string, string | number | null | undefined][] }[] = [
    {
      title: 'Client',
      rows: [
        ['Client Name', c.client_name || c.name],
        ['Status', c.status],
        ['SPOCs', (c.company_spocs ?? []).map((spoc) => spoc.name).join(', ') || '—'],
        ['Linked Demands', linkedDemands],
      ],
    },
    {
      title: 'Contact Details',
      rows: [
        ['Email', c.email],
        ['Phone', c.phone],
        ['Website', c.website],
      ],
    },
    {
      title: 'Location',
      rows: [
        ['Address', c.address],
        ['City', c.city],
        ['State', c.state],
        ['Country', c.country],
        ['Other Details', c.other_details],
      ],
    },
    {
      title: 'Audit',
      rows: [
        ['Created By', c.created_by_name],
        ['Last Updated By', c.updated_by_name],
        ['Created At', c.created_at ? new Date(c.created_at).toLocaleString() : null],
        ['Last Updated', c.updated_at ? new Date(c.updated_at).toLocaleString() : null],
      ],
    },
  ];

  // The detail query is the one that gates the whole modal body — the rounds query only feeds
  // the last card, so it deliberately does NOT hold the loader (otherwise a slow rounds call
  // would blank out sections that are already loaded).
  const isLoading = detailQuery.isLoading;
  const isError = detailQuery.isError;
  const rounds = roundsQuery.data?.rounds ?? [];

  return (
    <Modal
      title={`Company — ${company.name}`}
      subtitle="Company master record — read only"
      size="large"
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* One loader for the whole modal, from the project's shared component — the previous
            plain-text "Loading company…" had no spinner and was the only loading affordance.
            Loading / error / success are mutually exclusive branches, so a loader is never
            shown alongside content. */}
        {isLoading ? (
          <Loader message="Loading company…" />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-[0.9rem] font-semibold text-[#dc2626]">Could not load this company.</p>
            <p className="text-[0.8rem] text-[#94a3b8]">
              The request failed, so the details below may be out of date.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => detailQuery.refetch()}>
                Try Again
              </Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            {sections.map((section) => (
              <div key={section.title} className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-3 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                  {section.title}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {section.rows.map(([label, value]) => (
                    <div key={label} className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <div className="text-[0.7rem] font-bold uppercase tracking-wide text-[#64748b]">{label}</div>
                      <div className="mt-0.5 break-words text-[0.85rem] text-[#0f172a]">
                        {value === null || value === undefined || value === '' ? '—' : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
              <div className="mb-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                Interview Template
              </div>
              <p className="mb-3 text-[0.78rem] text-[#94a3b8]">
                This company&apos;s interview rounds. New demands inherit these unless they configure
                their own.
              </p>
              {roundsQuery.isLoading ? (
                /* Scoped to this card, matching the pattern used by the other round-config
                   surfaces (InterviewRoundConfigurator, CandidateInterviewsSection). It can
                   never co-exist with the modal-level loader above: while that one is up this
                   card isn't rendered at all, so exactly one loader is on screen. Without it
                   the card would flash "no configuration" before the rounds arrive. */
                <Loader message="" size="sm" className="p-4" />
              ) : roundsQuery.isError ? (
                <div className="text-[0.8rem] text-[#dc2626]">
                  Could not load this company&apos;s interview rounds.{' '}
                  <button
                    type="button"
                    onClick={() => roundsQuery.refetch()}
                    className="cursor-pointer font-semibold underline"
                  >
                    Try again
                  </button>
                </div>
              ) : rounds.length === 0 ? (
                <div className="text-[0.8rem] text-[#94a3b8]">
                  No interview rounds configured for this company yet.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {rounds.map((r) => (
                    <div key={r.round_id} className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[0.83rem] ${r.isActive === false ? 'opacity-60' : ''}`}>
                      <span className="w-5 font-bold text-[#2563eb]">{r.order}</span>
                      <span className="flex-1 font-medium text-[#0f172a]">{r.name}</span>
                      <span className="flex-1 text-[#64748b]">{r.mode || '—'}</span>
                      {r.mandatory && (
                        <span className="text-[0.72rem] font-semibold text-[#475569]">Mandatory</span>
                      )}
                      {r.isActive === false && (
                        <span className="shrink-0 rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#94a3b8]">Inactive</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}