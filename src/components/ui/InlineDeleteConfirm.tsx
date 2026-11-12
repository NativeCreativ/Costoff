'use client';

import { Button } from '@/components/ui/button';

interface InlineDeleteConfirmProps {
  isConfirming: boolean;
  onDeleteRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  label?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function InlineDeleteConfirm({ isConfirming, onDeleteRequest, onConfirm, onCancel, label = 'Delete', fullWidth, disabled, disabledReason }: InlineDeleteConfirmProps) {
  if (isConfirming) {
    return (
      <span className={`inline-flex items-center gap-1 rounded border border-[#fca5a5] bg-[#fef2f2] px-1.5 py-0.5 ${fullWidth ? 'w-full justify-center' : ''}`}>
        <span className="text-[0.7rem] font-bold text-[#dc2626]">Confirm?</span>
        <Button
          onClick={onConfirm}
          className="h-auto rounded-[3px] border-none bg-[#dc2626] px-1.5 py-0.5 text-[0.7rem] font-bold text-white hover:bg-[#dc2626]/90"
        >
          Yes
        </Button>
        <Button
          onClick={onCancel}
          className="h-auto rounded-[3px] border-none bg-[#94a3b8] px-1.5 py-0.5 text-[0.7rem] font-normal text-white hover:bg-[#94a3b8]/90"
        >
          No
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={onDeleteRequest}
      title={disabled ? disabledReason : label}
      disabled={disabled}
      className={`h-auto justify-center gap-1 rounded-md px-2 py-1 text-[0.75rem] font-semibold ${fullWidth ? 'w-full' : ''} ${disabled ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#cbd5e1]' : 'border-[#fee2e2] bg-[#fff5f5] text-[#dc2626] hover:bg-[#fff5f5]/80'}`}
    >
      <i className="fa-solid fa-trash-can"></i> Delete
    </Button>
  );
}
