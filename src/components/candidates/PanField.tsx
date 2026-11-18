'use client';

import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { FormField } from '@/components/ui/FormField';
import { getCandidatePan } from '@/services/candidate.service';

interface PanFieldProps {
  register: UseFormRegisterReturn;
  error?: string;
  savedCandidate?: { id: string; pan_last4?: string | null } | null;
}

/**
 * PAN card number. Stored encrypted; the form never receives the saved PAN. On edit it shows the
 * last 4 characters and a "Show" link (the server only answers someone who may edit the
 * candidate). Typing a new PAN replaces the saved one; leaving the box empty keeps it.
 */
export function PanField({ register, error, savedCandidate }: PanFieldProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const last4 = savedCandidate?.pan_last4;

  const reveal = async () => {
    if (!savedCandidate) return;
    setLoading(true);
    setRevealError(null);
    try {
      setRevealed((await getCandidatePan(savedCandidate.id)) ?? 'Not readable');
    } catch {
      setRevealError('You cannot view this PAN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <FormField
        label="PAN Card"
        placeholder={last4 ? 'Type a new PAN to replace the saved one' : 'e.g. ABCDE1234F'}
        transform={(raw) => raw.toUpperCase().slice(0, 12)}
        register={register}
        error={error}
        hint="Stored encrypted"
      />
      {last4 && (
        <div className="flex items-center gap-2 text-[0.74rem] text-[#475569]">
          <span>Saved: <span className="font-mono">{revealed ?? `XXXXXX${last4}`}</span></span>
          {!revealed && (
            <button type="button" className="font-semibold text-[#2563eb] hover:underline disabled:opacity-60" onClick={reveal} disabled={loading}>
              {loading ? 'Loading…' : 'Show'}
            </button>
          )}
          {revealError && <span className="text-[#dc2626]">{revealError}</span>}
        </div>
      )}
    </div>
  );
}
