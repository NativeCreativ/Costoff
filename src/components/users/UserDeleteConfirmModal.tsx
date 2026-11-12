'use client';

import { Profile } from '../types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface UserDeleteConfirmModalProps {
  deletingUser: Profile;
  onCancel: () => void;
  onConfirm: (id: string) => void;
  isDeleting?: boolean;
}

export function UserDeleteConfirmModal({ deletingUser, onCancel, onConfirm, isDeleting }: UserDeleteConfirmModalProps) {
  return (
    <Modal title="Delete User" subtitle="This action cannot be undone" width="440px" onClose={onCancel} closeDisabled={isDeleting}>
      <div className="flex flex-col gap-4">
        <p className="text-[0.88rem] text-[#334155]">
          Are you sure you want to delete <strong className="font-semibold text-[#0f172a]">{deletingUser.full_name}</strong> ({deletingUser.email})? This will permanently remove their account and access.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-auto rounded-md border-[#e2e8f0] px-4 py-2 font-normal"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isDeleting}
            onClick={() => onConfirm(deletingUser.id)}
            className="h-auto rounded-md bg-[#dc2626] px-4 py-2 font-semibold text-white hover:bg-[#dc2626]/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
