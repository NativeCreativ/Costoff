'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './button';

interface ErrorDialogProps {
  /** Short headline for the refusal, e.g. "Cannot Delete Candidate". */
  title: string;
  /** The server's validation message — the actual reason the action was refused.
   *  Shown in the app's standard red error banner. */
  message: ReactNode;
  /** Optional lead-in above the message (e.g. which record was targeted). */
  description?: ReactNode;
  /** Label for the single dismiss action. */
  confirmLabel?: string;
  onClose: () => void;
}

/**
 * Read-only "that action was refused" dialog, for when a mutation is blocked by a server
 * validation rule (e.g. deleting a candidate that is still part of an active workflow).
 *
 * It deliberately has NO confirm/destructive action: the request was never applied, so the
 * only thing left to do is acknowledge the reason and close. Replaces native browser
 * `alert()` calls so the refusal looks like the rest of the app. Built on the shared
 * `Modal`/`Button` primitives and the same red banner the other modals use for errors.
 */
export function ErrorDialog({ title, message, description, confirmLabel = 'OK', onClose }: ErrorDialogProps) {
  return (
    <Modal title={title} subtitle={description} width="440px" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{message}</span>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose} className="h-auto rounded-md px-4 py-2 font-semibold">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
