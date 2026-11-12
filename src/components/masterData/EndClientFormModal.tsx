'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { useToast } from '@/components/ui/Toast';
import { COMPANY_STATUS_OPTIONS } from '@/constants/options';
import { endClientFormSchema, type EndClientFormValues } from './endClient.schema';
import { SpocListEditor } from './SpocListEditor';
import { useCreateEndClientMutation, useUpdateEndClientMutation } from '@/queries/endClients/useEndClients';
import type { EndClient } from '@/services/endClient.service';

const EMPTY: EndClientFormValues = {
  name: '',
  location: '',
  description: '',
  status: 'ACTIVE',
  spocs: [],
};

function toForm(client?: EndClient | null): EndClientFormValues {
  if (!client) return EMPTY;
  return {
    name: client.name,
    location: client.location || '',
    description: client.description || '',
    status: client.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    spocs: (client.end_client_spocs ?? []).map((spoc) => ({
      name: spoc.name,
      email: spoc.email || '',
      phone: spoc.phone || '',
      designation: spoc.designation || '',
    })),
  };
}

export function EndClientFormModal({
  client,
  onClose,
}: {
  client?: EndClient | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const createMutation = useCreateEndClientMutation();
  const updateMutation = useUpdateEndClientMutation();
  const isEdit = !!client;
  const { register, control, handleSubmit, formState: { errors } } = useForm<EndClientFormValues>({
    resolver: zodResolver(endClientFormSchema),
    defaultValues: toForm(client),
  });
  const pending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: EndClientFormValues) => {
    const cleaned = {
      ...values,
      spocs: values.spocs.filter((spoc) => spoc.name.trim()),
    };
    const onError = (err: unknown) => {
      const text = isAxiosError(err) ? err.response?.data?.error || 'Failed to save end client' : 'Failed to save end client';
      toast.error('Save failed', text);
    };
    if (isEdit && client) {
      updateMutation.mutate({ id: client.id, form: cleaned }, { onSuccess: () => { toast.success('End client updated'); onClose(); }, onError });
      return;
    }
    createMutation.mutate(cleaned, { onSuccess: () => { toast.success('End client added'); onClose(); }, onError });
  };

  return (
    <Modal title={isEdit ? 'Edit End Client' : 'Add End Client'} size="large" onClose={onClose} closeDisabled={pending}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Name" required register={register('name')} error={errors.name?.message} placeholder="e.g. Northwind Bank" />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormSelect label="Status" options={COMPANY_STATUS_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        <FormField label="Address / location" register={register('location')} error={errors.location?.message} placeholder="City or full address" />
        <FormTextArea label="Description" rows={3} register={register('description')} error={errors.description?.message} />
        <div>
          <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">SPOC list (optional)</div>
          <Controller
            name="spocs"
            control={control}
            render={({ field }) => (
              <SpocListEditor value={field.value} onChange={field.onChange} error={errors.spocs?.message} />
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
