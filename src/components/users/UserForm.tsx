'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@/components/ui/FormField';
import { FormSelect } from '@/components/ui/FormSelect';
import { Button } from '@/components/ui/button';
import { userSchema, userCreateSchema, UserFormValues } from './user.schema';
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/constants/options';
import { generatePassword } from '@/lib/generatePassword';

interface UserFormProps {
  defaultValues: UserFormValues;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel?: string;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export function UserForm({ defaultValues, onSubmit, onCancel, submitLabel, pendingLabel, isSubmitting, mode = 'edit' }: UserFormProps) {
  const isCreate = mode === 'create';
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(isCreate ? userCreateSchema : userSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First Name" required placeholder="e.g. Ramesh" register={register('first_name')} error={errors.first_name?.message} />
        <FormField label="Last Name" required placeholder="e.g. Kumar" register={register('last_name')} error={errors.last_name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Email" required type="email" placeholder="e.g. ramesh@costaff.in" register={register('email')} error={errors.email?.message} />
        <FormField label="Phone Number" required placeholder="e.g. 9876543210" register={register('phone')} error={errors.phone?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date of Joining" type="date" register={register('date_of_joining')} error={errors.date_of_joining?.message} />
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <FormSelect label="Role" options={USER_ROLE_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormSelect label="Status" options={USER_STATUS_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
        {isCreate && (
          <FormField
            label="Password"
            required
            type="password"
            placeholder="Minimum 8 characters"
            register={register('password')}
            error={errors.password?.message}
            onGenerate={() => setValue('password', generatePassword(), { shouldValidate: true, shouldDirty: true })}
          />
        )}
      </div>

      <div className="mt-2.5 flex justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal">Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">{isSubmitting ? (pendingLabel ?? submitLabel) : submitLabel}</Button>
      </div>
    </form>
  );
}
