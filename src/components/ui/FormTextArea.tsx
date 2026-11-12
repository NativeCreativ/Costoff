'use client';

import { UseFormRegisterReturn } from 'react-hook-form';
import { Textarea } from './textarea';

interface FormTextAreaProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  register: UseFormRegisterReturn;
  error?: string;
}

export function FormTextArea({ label, required, placeholder, rows = 2, register, error }: FormTextAreaProps) {
  return (
    <div>
      <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">{label}{required && <span className="text-[#dc2626]"> *</span>}</label>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        {...register}
        className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
      />
      {error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}
