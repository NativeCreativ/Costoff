'use client';

import { Pencil, Trash2, Lock } from 'lucide-react';

interface SettingsItemRowActionsProps {
  name: string;
  isActive: boolean;
  onEdit?: (e?: React.MouseEvent) => void;
  onDelete?: (e?: React.MouseEvent) => void;
  onToggle?: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  /** When set, edit/delete are disabled and this message is shown as their tooltip. */
  lockedMessage?: string;
  /** When set, ONLY the Active/Inactive switch is disabled (edit/delete stay usable) and this
   *  message is its tooltip — the last-active guard on Interview Modes. */
  toggleBlockedMessage?: string;
  pending?: boolean;
  showToggle?: boolean;
}

export function SettingsItemRowActions({
  name,
  isActive,
  onEdit,
  onDelete,
  onToggle,
  disabled = false,
  lockedMessage,
  toggleBlockedMessage,
  pending = false,
  showToggle = true,
}: SettingsItemRowActionsProps) {
  const tipId = `tip-${name.replace(/\s+/g, '-').toLowerCase()}`;
  const toggleTipId = `${tipId}-toggle`;
  const isLocked = !!lockedMessage;
  const toggleBlocked = !!toggleBlockedMessage;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {isLocked ? (
        <span
          className="flex cursor-not-allowed items-center text-[#cbd5e1]"
          aria-disabled="true"
          aria-describedby={tipId}
          title={lockedMessage}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span id={tipId} className="sr-only">{lockedMessage}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled || pending}
          className="text-[#cbd5e1] hover:text-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {isLocked ? (
        <span
          className="flex cursor-not-allowed items-center text-[#cbd5e1]"
          aria-disabled="true"
          aria-describedby={tipId}
          title={lockedMessage}
        >
          <Trash2 className="h-4 w-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || pending}
          className="text-[#cbd5e1] hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {isLocked && (
        <span className="flex items-center text-[#94a3b8]" aria-hidden="true" title={lockedMessage}>
          <Lock className="h-3.5 w-3.5" />
        </span>
      )}

      {showToggle && onToggle && (toggleBlocked ? (
        <span
          className="inline-flex"
          aria-disabled="true"
          aria-describedby={toggleTipId}
          title={toggleBlockedMessage}
        >
          <span
            role="switch"
            aria-checked={isActive}
            aria-disabled="true"
            aria-label={isActive ? `Deactivate ${name}` : `Activate ${name}`}
            className={`relative inline-flex h-4 w-7 cursor-not-allowed items-center rounded-full opacity-50 ${
              isActive ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
          <span id={toggleTipId} className="sr-only">{toggleBlockedMessage}</span>
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={isActive ? `Deactivate ${name}` : `Activate ${name}`}
          onClick={onToggle}
          disabled={disabled || pending}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              isActive ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ))}

      {!isActive && (
        <span className="shrink-0 rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#94a3b8]">
          Inactive
        </span>
      )}
    </span>
  );
}
