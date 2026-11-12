'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { useToast } from '@/components/ui/Toast';
import { TODO_PRIORITY_VALUES, todayInIndia, todoSchema, type TodoValues } from './teamWork.schema';
import { useCreateTodoMutation, useUpdateTodoMutation } from '@/queries/teamWork/useTodos';
import type { TodoItem } from '@/services/teamWork.service';

/** Default active period for a new item: today plus 7 days. */
function plusDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toForm(item?: TodoItem | null): TodoValues {
  const today = todayInIndia();
  if (!item) return { title: '', details: '', priority: 'High', active_from: today, active_until: plusDays(today, 7), is_published: true };
  return {
    title: item.title,
    details: item.details || '',
    priority: (TODO_PRIORITY_VALUES as readonly string[]).includes(item.priority) ? (item.priority as TodoValues['priority']) : 'Medium',
    active_from: item.active_from,
    active_until: item.active_until,
    is_published: item.is_published,
  };
}

export function TodoFormModal({ item, onClose }: { item?: TodoItem | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateTodoMutation();
  const update = useUpdateTodoMutation();
  const pending = create.isPending || update.isPending;
  const { register, control, handleSubmit, formState: { errors } } = useForm<TodoValues>({
    resolver: zodResolver(todoSchema),
    defaultValues: toForm(item),
  });

  const onSubmit = (values: TodoValues) => {
    const done = (text: string) => () => { toast.success(text); onClose(); };
    if (item) update.mutate({ id: item.id, values }, { onSuccess: done('To-Do item updated') });
    else create.mutate(values, { onSuccess: done(values.is_published ? 'To-Do item published' : 'Draft saved') });
  };

  return (
    <Modal
      title={item ? 'Edit To-Do Item' : 'New To-Do Item'}
      subtitle="Published items are visible to everyone between the two dates."
      onClose={onClose}
      closeDisabled={pending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <FormField label="Title" required placeholder="e.g. Close 3 Java positions for Infranova this week" register={register('title')} error={errors.title?.message} />
        <FormTextArea label="Details" rows={3} register={register('details')} error={errors.details?.message} />
        <div className="grid grid-cols-3 gap-3">
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Priority"
                required
                options={TODO_PRIORITY_VALUES.map((p) => ({ value: p, label: p }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FormField label="Active from" required type="date" register={register('active_from')} error={errors.active_from?.message} />
          <FormField label="Active until" required type="date" register={register('active_until')} error={errors.active_until?.message} />
        </div>
        <Controller
          name="is_published"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-[0.82rem] text-[#334155]">
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              Publish to everyone (leave unticked to keep it as a private draft)
            </label>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
