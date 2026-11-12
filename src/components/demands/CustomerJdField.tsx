'use client';

import { useRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { FileText, Paperclip, X } from 'lucide-react';
import { FormTextArea } from '@/components/ui/FormTextArea';
import { Button } from '@/components/ui/button';
import { useUploadCustomerJdMutation } from '@/queries/demands/useUploadCustomerJdMutation';

interface CustomerJdFieldProps {
  /** The pasted JD text (demands.customer_jd). */
  register: UseFormRegisterReturn;
  error?: string;
  fileUrl: string;
  fileName: string;
  onFileChange: (file: { url: string; name: string }) => void;
}

const ACCEPT = '.pdf,.doc,.docx,.txt,.rtf';

/**
 * Customer JD: the customer's exact JD as pasted text, an attached file, or both. The file is
 * uploaded as soon as it is picked (POST /api/uploads/jd) and the form only keeps its url, so
 * Add Demand works before the demand has an id. Removing the file just clears the url.
 */
export function CustomerJdField({ register, error, fileUrl, fileName, onFileChange }: CustomerJdFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCustomerJdMutation();

  const handlePick = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, { onSuccess: (result) => onFileChange(result) });
    // Lets the same file be picked again after a remove.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FormTextArea label="Customer JD" rows={3} placeholder="Paste the customer's exact JD, or attach the file below" register={register} error={error} />
      <div className="flex flex-wrap items-center gap-2">
        {fileUrl ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-[0.78rem]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-[#2563eb] hover:underline">
              {fileName || 'Customer JD'}
            </a>
            <button
              type="button"
              aria-label="Remove the attached JD"
              className="text-[#94a3b8] hover:text-[#dc2626]"
              onClick={() => onFileChange({ url: '', name: '' })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[0.75rem]"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {upload.isPending ? 'Uploading…' : fileUrl ? 'Replace file' : 'Attach JD file'}
        </Button>
        <span className="text-[0.7rem] text-[#94a3b8]">PDF, Word or text, up to 10 MB</span>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handlePick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
