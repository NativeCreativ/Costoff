import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCompensationCurrency,
  updateCompensationCurrency,
  deleteCompensationCurrency,
  reorderCompensationCurrencies,
  toggleCompensationCurrency,
  createCompensationType,
  updateCompensationType,
  deleteCompensationType,
  reorderCompensationTypes,
  toggleCompensationType,
  type CompensationCurrencyPayload,
  type CompensationTypePayload,
} from '@/services/compensationMaster.service';

const CURRENCIES_KEY = ['compensation-currencies'];
const CURRENCIES_KEY_INACTIVE = ['compensation-currencies', 'include-inactive'];
const TYPES_KEY = ['compensation-types'];
const TYPES_KEY_INACTIVE = ['compensation-types', 'include-inactive'];

export function useCreateCompensationCurrencyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompensationCurrencyPayload) => createCompensationCurrency(payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY_INACTIVE }),
      ]),
  });
}

export function useUpdateCompensationCurrencyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CompensationCurrencyPayload }) => updateCompensationCurrency(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY_INACTIVE }),
      ]),
  });
}

export function useDeleteCompensationCurrencyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompensationCurrency(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY_INACTIVE }),
      ]),
  });
}

export function useReorderCompensationCurrenciesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderCompensationCurrencies(orderedIds),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY_INACTIVE }),
      ]),
  });
}

export function useCreateCompensationTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompensationTypePayload) => createCompensationType(payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TYPES_KEY }),
        queryClient.invalidateQueries({ queryKey: TYPES_KEY_INACTIVE }),
      ]),
  });
}

export function useUpdateCompensationTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CompensationTypePayload }) => updateCompensationType(id, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TYPES_KEY }),
        queryClient.invalidateQueries({ queryKey: TYPES_KEY_INACTIVE }),
      ]),
  });
}

export function useDeleteCompensationTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompensationType(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TYPES_KEY }),
        queryClient.invalidateQueries({ queryKey: TYPES_KEY_INACTIVE }),
      ]),
  });
}

export function useReorderCompensationTypesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderCompensationTypes(orderedIds),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TYPES_KEY }),
        queryClient.invalidateQueries({ queryKey: TYPES_KEY_INACTIVE }),
      ]),
  });
}

export function useToggleCompensationCurrencyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleCompensationCurrency(id, isActive),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
        queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY_INACTIVE }),
      ]),
  });
}

export function useToggleCompensationTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleCompensationType(id, isActive),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TYPES_KEY }),
        queryClient.invalidateQueries({ queryKey: TYPES_KEY_INACTIVE }),
      ]),
  });
}
