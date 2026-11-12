'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/button';
import { Profile } from '../types';
import { changePasswordSchema, ChangePasswordValues } from './user.schema';
import { generatePassword } from '@/lib/generatePassword';

interface ChangePasswordModalProps {
  targetUser: Profile;
  onCancel: () => void;
  onSubmit: (values: ChangePasswordValues) => void;
  isSubmitting?: boolean;
  errorMessage?: string;
}

export function ChangePasswordModal({ targetUser, onCancel, onSubmit, isSubmitting, errorMessage }: ChangePasswordModalProps) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const handleGenerate = () => {
    const generated = generatePassword();
    setValue('newPassword', generated, { shouldValidate: true, shouldDirty: true });
    setValue('confirmPassword', generated, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Modal
      title="Change Password"
      subtitle={<>Set a new password for <span className="font-semibold text-[#0f172a]">{targetUser.full_name}</span></>}
      width="440px"
      onClose={onCancel}
      closeDisabled={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <FormField
          label="New Password"
          required
          type="password"
          placeholder="Minimum 8 characters"
          register={register('newPassword')}
          error={errors.newPassword?.message}
          onGenerate={handleGenerate}
        />
        <FormField
          label="Confirm Password"
          required
          type="password"
          placeholder="Re-enter new password"
          register={register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />

        {errorMessage && <span className="text-[0.78rem] text-[#dc2626]">{errorMessage}</span>}

        <div className="mt-2.5 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-auto rounded-md px-4 py-2 font-semibold">
            {isSubmitting ? 'Saving…' : 'Change Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
