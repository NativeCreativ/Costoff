import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCompany,
  updateCompany,
  quickCreateCompany,
  updateCompanyInterviewRounds,
  type CompanyFormPayload,
  type CompanyRoundWrite,
} from '@/services/company.service';

function invalidateCompanies(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['companies'] });
}

/** Create a Company from the Company module. */
export function useCreateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: CompanyFormPayload) => createCompany(form),
    onSuccess: () => invalidateCompanies(queryClient),
  });
}

/** Edit a Company. */
export function useUpdateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: CompanyFormPayload }) => updateCompany(id, form),
    onSuccess: () => {
      invalidateCompanies(queryClient);
      // A company rename/email change re-propagates onto its demands' mirrored columns, so
      // every demand-derived view must be refetched or it will keep showing the old name.
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

/**
 * Inline quick-create from the Demand form ("+ Add Company"). Collects only a name; the API
 * creates the master row OR reuses the existing one with the same normalized name, so
 * `created: false` is a normal, successful outcome rather than a duplicate.
 */
export function useQuickCreateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => quickCreateCompany(name),
    onSuccess: () => invalidateCompanies(queryClient),
  });
}

/**
 * Persist a company's configured interview rounds (add / remove / rename / reorder / Mandatory).
 *
 * Reached only from Edit Company in Clients Master — a demand save may seed a company's rounds
 * once but never replaces them, so this is the only mutation that can change an existing
 * company's configuration. An empty list is a valid "clear the configuration" save.
 */
export function useUpdateCompanyRoundsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rounds,
      remark,
    }: {
      id: string;
      rounds: CompanyRoundWrite[];
      remark?: string;
    }) => updateCompanyInterviewRounds(id, rounds, remark),
    onSuccess: (_data, variables) => {
      invalidateCompanies(queryClient);
      queryClient.invalidateQueries({ queryKey: ['company-interview-rounds', variables.id] });
      // A company's round change can change what its demands inherit.
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}