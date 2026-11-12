'use client';

import { Profile } from '../types';
import { UserFormState } from './UserFormModal';
import { Modal } from '@/components/ui/Modal';
import { UserForm } from './UserForm';

interface UserEditModalProps {
  editingUser: Profile;
  userForm: UserFormState;
  setUserForm: (v: UserFormState) => void;
  setShowEditUserModal: (v: boolean) => void;
  setEditingUser: (v: Profile | null) => void;
  handleUpdateUser: (values: UserFormState) => void;
  isSubmitting?: boolean;
}

export function UserEditModal({ editingUser, userForm, setUserForm, setShowEditUserModal, setEditingUser, handleUpdateUser, isSubmitting }: UserEditModalProps) {
  const close = () => { setShowEditUserModal(false); setEditingUser(null); };
  return (
    <Modal title={`Edit User — ${editingUser.full_name}`} subtitle="Update employee details, role, and status" width="560px" onClose={close} closeDisabled={isSubmitting}>
      <UserForm
        defaultValues={userForm}
        onSubmit={(values) => { setUserForm(values); handleUpdateUser(values); }}
        onCancel={close}
        submitLabel="Save Changes"
        pendingLabel="Saving…"
        isSubmitting={isSubmitting}
      />
    </Modal>
  );
}
