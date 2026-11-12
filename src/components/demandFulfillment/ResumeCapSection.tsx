'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/Toast';
import { useUpdateSuperAdminSettingsMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';

interface ResumeCapSectionProps {
  value: number;
}

/** Saves on blur/Enter, never per keystroke. Rejects a non-integer or < 1 value inline without
 *  calling the API, and reverts to the last-saved value on either a validation or an API failure. */
export function ResumeCapSection({ value }: ResumeCapSectionProps) {
  const toast = useToast();
  const mutation = useUpdateSuperAdminSettingsMutation();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mutation.isPending) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const n = Number(trimmed);
    if (!trimmed || !Number.isInteger(n) || n < 1) {
      setError('Resume cap must be a whole number of at least 1');
      setDraft(String(value));
      return;
    }
    setError(null);
    if (n === value) return;
    mutation.mutate(
      { resume_cap_per_position: n },
      {
        onSuccess: () => toast.success('Resume cap saved'),
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to save resume cap' : 'Failed to save resume cap';
          toast.error('Save failed', message);
          setDraft(String(value));
        },
      }
    );
  };

  return (
    <div>
      <Input
        type="number"
        min={1}
        value={draft}
        disabled={mutation.isPending}
        onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-auto w-32 rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
      />
      <p className="mt-2 text-[0.76rem] text-[#94a3b8]">
        With a cap of {Number(draft) || 0}, one position can have up to {Number(draft) || 0} resumes submitted.
      </p>
      {error && <div className="mt-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
