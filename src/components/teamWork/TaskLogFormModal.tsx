'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/FormField';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { useToast } from '@/components/ui/Toast';
import { taskLogSchema, todayInIndia, type TaskLogValues } from './teamWork.schema';
import { useCreateTaskLogMutation, useUpdateTaskLogMutation } from '@/queries/teamWork/useTaskLogs';
import type { TaskLog } from '@/services/teamWork.service';

function toForm(task?: TaskLog | null): TaskLogValues {
  const today = todayInIndia();
  if (!task) return { task_name: '', details: '', start_date: today, end_date: today, remarks: '', assigned_by: '', hours: '' };
  return {
    task_name: task.task_name,
    details: task.details || '',
    start_date: task.start_date,
    end_date: task.end_date || '',
    remarks: task.remarks || '',
    assigned_by: task.assigned_by || '',
    hours: task.hours == null ? '' : String(task.hours),
  };
}

export function TaskLogFormModal({ task, onClose }: { task?: TaskLog | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateTaskLogMutation();
  const update = useUpdateTaskLogMutation();
  const pending = create.isPending || update.isPending;
  const { register, handleSubmit, formState: { errors } } = useForm<TaskLogValues>({
    resolver: zodResolver(taskLogSchema),
    defaultValues: toForm(task),
  });

  const onSubmit = (values: TaskLogValues) => {
    if (task) {
      update.mutate({ id: task.id, values }, { onSuccess: () => { toast.success('Task updated'); onClose(); } });
    } else {
      create.mutate(values, { onSuccess: () => { toast.success('Task logged'); onClose(); } });
    }
  };

  return (
    <Modal title={task ? 'Edit Task' : 'Log a Task'} subtitle="Anything you worked on, not only demands." onClose={onClose} closeDisabled={pending}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <FormField label="Task name" required placeholder="e.g. Screened profiles for the Meridian QA demand" register={register('task_name')} error={errors.task_name?.message} />
        <FormTextArea label="Task details" rows={3} register={register('details')} error={errors.details?.message} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start date" required type="date" register={register('start_date')} error={errors.start_date?.message} />
          <FormField label="End date" type="date" register={register('end_date')} error={errors.end_date?.message} />
        </div>
        <p className="-mt-1 text-[0.72rem] text-[#94a3b8]">Leave the end date empty for a task that is still going on.</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Assigned by" placeholder="Who asked for this task" register={register('assigned_by')} error={errors.assigned_by?.message} />
          <FormField label="Hours" type="number" placeholder="e.g. 2.5" register={register('hours')} error={errors.hours?.message} />
        </div>
        <FormTextArea label="Remarks" rows={2} register={register('remarks')} error={errors.remarks?.message} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
