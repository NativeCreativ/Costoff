'use client';

import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface RemarkDialogProps {
  title: string;
  description?: ReactNode;
  /** When true the remark textarea is required (e.g. On Hold, Cancel, Reject, backward moves). */
  remarkRequired?: boolean;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'destructive';
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConfirm: (remark: string) => void;
  onClose: () => void;
}

/**
 * Shared remark-capture dialog used by every action in the module (status changes,
 * hold/cancel/reopen, candidate rejection, interview feedback, etc.) — the client
 * requires an (optionally mandatory) remark on every action.
 */
export function RemarkDialog({
  title,
  description,
  remarkRequired,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: RemarkDialogProps) {
  const [remark, setRemark] = useState('');
  const trimmed = remark.trim();
  const blocked = remarkRequired && !trimmed;

  return (
    <Modal title={title} subtitle={description} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">
            Remark {remarkRequired && <span className="text-[#dc2626]">*</span>}
            {!remarkRequired && <span className="font-normal text-[#94a3b8]"> (optional)</span>}
          </label>
          <Textarea
            autoFocus
            rows={4}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Add context for this action…"
            className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
          />
          {remarkRequired && (
            <span className="mt-1 block text-[0.72rem] text-[#94a3b8]">A remark is required for this action.</span>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{errorMessage}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={blocked || isSubmitting}
            onClick={() => onConfirm(trimmed)}
            className={confirmVariant === 'destructive' ? 'bg-[#dc2626] text-white hover:bg-[#dc2626]/90' : undefined}
          >
            {isSubmitting ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
