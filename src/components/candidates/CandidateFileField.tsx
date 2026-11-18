'use client';

import { useRef } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadCandidateFileMutation } from '@/queries/candidates/useCandidateMutations';
import type { CandidateFileKind } from '@/services/candidate.service';

const ACCEPT: Record<CandidateFileKind, string> = {
  resume: '.pdf,.doc,.docx,.rtf,.txt',
  rtr: '.pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.eml,.msg',
  photo: '.jpg,.jpeg,.png,.webp',
};
const HINT: Record<CandidateFileKind, string> = {
  resume: 'PDF or Word, up to 10 MB',
  rtr: 'PDF, Word, image or email, up to 10 MB',
  photo: 'Passport-size JPG or PNG, up to 10 MB',
};

interface CandidateFileFieldProps {
  kind: CandidateFileKind;
  label: string;
  url: string;
  name: string;
  onChange: (file: { url: string; name: string }) => void;
}

/** Resume / photo / RTR attachment: uploaded as soon as it is picked; the form keeps the url. */
export function CandidateFileField({ kind, label, url, name, onChange }: CandidateFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCandidateFileMutation();

  const pick = (file: File | undefined) => {
    if (!file) return;
    upload.mutate({ kind, file }, { onSuccess: (result) => onChange(result) });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.8rem] font-semibold text-[#475569]">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {url ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-[0.78rem]">
            {kind === 'photo' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Candidate photo" className="h-10 w-8 rounded object-cover" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-[#2563eb] hover:underline">
              {name || (kind === 'photo' ? 'View photo' : 'View file')}
            </a>
            <button type="button" aria-label={`Remove ${label}`} className="text-[#94a3b8] hover:text-[#dc2626]" onClick={() => onChange({ url: '', name: '' })}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[0.75rem]" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />
          {upload.isPending ? 'Uploading…' : url ? 'Replace' : 'Attach'}
        </Button>
        <span className="text-[0.7rem] text-[#94a3b8]">{HINT[kind]}</span>
        <input ref={inputRef} type="file" accept={ACCEPT[kind]} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
