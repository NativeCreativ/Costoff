'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/button';
import { clientSchema } from './client.schema';

export interface ClientFormState {
  name: string;
  industry: string;
  location: string;
  notes: string;
}

interface ClientFormModalProps {
  clientForm: ClientFormState;
  setClientForm: (v: ClientFormState) => void;
  setShowClientModal: (v: boolean) => void;
  handleCreateClient: (values: ClientFormState) => void;
  isSubmitting?: boolean;
}

export function ClientFormModal({ clientForm, setClientForm, setShowClientModal, handleCreateClient, isSubmitting }: ClientFormModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormState>({
    resolver: zodResolver(clientSchema),
    defaultValues: clientForm,
  });

  const close = () => setShowClientModal(false);
  const onSubmit = (values: ClientFormState) => { setClientForm(values); handleCreateClient(values); };

  return (
    <Modal title="Add Client Account" width="450px" onClose={close} closeDisabled={isSubmitting}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <FormField label="Client Account Name" required placeholder="e.g. Acme Tech Solutions" register={register('name')} error={errors.name?.message} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Industry" placeholder="e.g. IT Services" register={register('industry')} />
          <FormField label="Location" placeholder="e.g. Bangalore" register={register('location')} />
        </div>
        <div className="mt-2.5 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={close} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal">Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">{isSubmitting ? 'Saving…' : 'Save Account'}</Button>
        </div>
      </form>
    </Modal>
  );
}
