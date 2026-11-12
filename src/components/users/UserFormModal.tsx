'use client';

import { Modal } from '@/components/ui/Modal';
import { UserForm } from './UserForm';
import { UserFormValues } from './user.schema';

export type UserFormState = UserFormValues;

interface UserFormModalProps {
  userForm: UserFormState;
  setUserForm: (v: UserFormState) => void;
  setShowUserModal: (v: boolean) => void;
  handleCreateUser: (values: UserFormState) => void;
  isSubmitting?: boolean;
}

export function UserFormModal({ userForm, setUserForm, setShowUserModal, handleCreateUser, isSubmitting }: UserFormModalProps) {
  const close = () => setShowUserModal(false);

  return (
    <Modal title="Add System User" subtitle="Create an internal employee account and assign access" width="560px" onClose={close} closeDisabled={isSubmitting}>
      <UserForm
        defaultValues={userForm}
        onSubmit={(values) => { setUserForm(values); handleCreateUser(values); }}
        onCancel={close}
        submitLabel="Create User"
        pendingLabel="Creating…"
        isSubmitting={isSubmitting}
        mode="create"
      />
    </Modal>
  );
}
