'use client';

import { useState } from 'react';
import { UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';

interface FormFieldProps {
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: string;
  small?: boolean;
  listId?: string;
  disabled?: boolean;
  /** Read-only but still focusable/copyable, for a value that exists but cannot change. */
  readOnly?: boolean;
  min?: string;
  /** Rewrites the raw value before react-hook-form sees it; covers typing, paste and autofill. */
  transform?: (raw: string) => string;
  /** Caps the field to this many digits as the user types (non-digit characters are
   *  stripped first), e.g. for a money field that must never exceed 10 digits. */
  maxDigits?: number;
  /** Optional secondary action shown to the left of the show/hide toggle (e.g. "Generate" for password fields). */
  onGenerate?: () => void;
  generateLabel?: string;
  /** Optional muted helper text below the input. Rendered only when provided, so existing
   *  callers are unaffected. */
  hint?: string;
  /** Browser autofill hint, e.g. "off" or "new-password" so a saved login is not filled in. */
  autoComplete?: string;
}

export function FormField({ label, required, type = 'text', placeholder, register, error, small, listId, disabled, readOnly, min, maxDigits, transform, onGenerate, generateLabel = 'Generate', hint, autoComplete }: FormFieldProps) {
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  const { onChange: registerOnChange, ...registerRest } = register;

  return (
    <div>
      {label && (
        <label className={`mb-1 block font-semibold text-[#475569] ${small ? 'text-[0.78rem]' : 'text-[0.8rem]'}`}>
          {label}{required && <span className="text-[#dc2626]"> *</span>}
        </label>
      )}
      <div className={isPassword ? 'relative' : undefined}>
        <Input
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          list={listId}
          min={min}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          {...registerRest}
          onChange={
            transform
              ? (e) => {
                  // Write to the DOM first so react-hook-form stores the transformed value.
                  const cleaned = transform(e.target.value);
                  if (cleaned !== e.target.value) e.target.value = cleaned;
                  return registerOnChange(e);
                }
              : maxDigits
              ? (e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
                  if (digitsOnly !== e.target.value) e.target.value = digitsOnly;
                  return registerOnChange(e);
                }
              : registerOnChange
          }
          className={
            (small
              ? 'h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none'
              : 'h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none') +
            (isPassword ? (onGenerate ? ' pr-24' : ' pr-9') : '')
          }
        />
        {isPassword && onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            tabIndex={-1}
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
          >
            {generateLabel}
          </button>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && !error && <span className="mt-1 block text-[0.72rem] text-[#94a3b8]">{hint}</span>}
      {error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}
