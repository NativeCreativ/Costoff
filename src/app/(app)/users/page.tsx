'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setFilter, setPage, setPageSize, setSearch, LISTS } from '@/features/listState/listStateSlice';
import { useUsersQuery } from '@/queries/users/useUsersQuery';
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useChangeUserPasswordMutation,
} from '@/queries/users/useUserMutations';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { RequireRole } from '@/components/layout/RequireRole';
import { UsersView } from '@/components/users/UsersView';
import { UserFormModal, type UserFormState } from '@/components/users/UserFormModal';
import { UserEditModal } from '@/components/users/UserEditModal';
import { UserViewModal } from '@/components/users/UserViewModal';
import { UserDeleteConfirmModal } from '@/components/users/UserDeleteConfirmModal';
import { ChangePasswordModal } from '@/components/users/ChangePasswordModal';
import type { ChangePasswordValues } from '@/components/users/user.schema';
import type { Profile } from '@/components/types';

const emptyUserForm: UserFormState = {
  first_name: '', last_name: '', email: '', phone: '',
  date_of_joining: '', role: 'viewer', status: 'ACTIVE', password: '',
};

/** /users — User Management. super_admin only, same gate as before. */
export default function UsersPage() {
  return (
    <RequireRole role="super_admin">
      <UsersPageContent />
    </RequireRole>
  );
}

function UsersPageContent() {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.listState[LISTS.users]);
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data ?? null;

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);

  const filter = (key: string) => list.filters[key] ?? '';
  const setFilterValue = (key: string) => (v: string) =>
    dispatch(setFilter({ list: LISTS.users, key, value: v }));

  const usersQuery = useUsersQuery({
    search: list.search,
    role: filter('role'),
    status: filter('status'),
    page: list.page,
    pageSize: list.pageSize,
  });

  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const changeUserPasswordMutation = useChangeUserPasswordMutation();

  const handleOpenCreateUser = () => {
    setUserForm(emptyUserForm);
    setShowUserModal(true);
  };

  const handleCreateUser = (values: UserFormState) => {
    createUserMutation.mutate(values, {
      onSuccess: () => {
        setShowUserModal(false);
        setUserForm(emptyUserForm);
      },
      onError: (err) => console.error('Error creating user:', err),
    });
  };

  const handleEditUser = (item: Profile) => {
    setEditingUser(item);
    setUserForm({
      first_name: item.first_name || item.full_name.split(' ')[0] || '',
      last_name: item.last_name || item.full_name.split(' ').slice(1).join(' ') || '',
      email: item.email,
      phone: item.phone || '',
      date_of_joining: item.date_of_joining ? item.date_of_joining.slice(0, 10) : '',
      role: item.role as UserFormState['role'],
      status: item.status as UserFormState['status'],
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = (values: UserFormState) => {
    if (!editingUser) return;
    updateUserMutation.mutate(
      { id: editingUser.id, form: values },
      {
        onSuccess: () => {
          setShowEditUserModal(false);
          setEditingUser(null);
          setUserForm(emptyUserForm);
        },
        onError: (err) => console.error('Error updating user:', err),
      },
    );
  };

  const handleChangeUserPassword = (values: ChangePasswordValues) => {
    if (!changingPasswordUser) return;
    changeUserPasswordMutation.mutate(
      { id: changingPasswordUser.id, newPassword: values.newPassword, confirmPassword: values.confirmPassword },
      {
        onSuccess: () => setChangingPasswordUser(null),
        onError: (err) => console.error('Error changing password:', err),
      },
    );
  };

  return (
    <>
      <UsersView
        profiles={usersQuery.data?.data ?? []}
        total={usersQuery.data?.total ?? 0}
        page={list.page}
        totalPages={usersQuery.data?.totalPages ?? 1}
        onPageChange={(page: number) => dispatch(setPage({ list: LISTS.users, page }))}
        pageSize={list.pageSize}
        onPageSizeChange={(pageSize: number) => dispatch(setPageSize({ list: LISTS.users, pageSize }))}
        isFetching={usersQuery.isFetching}
        loadingUsers={usersQuery.isLoading}
        setShowUserModal={(v) => (v ? handleOpenCreateUser() : setShowUserModal(false))}
        userSearch={list.search}
        setUserSearch={(v: string) => dispatch(setSearch({ list: LISTS.users, value: v }))}
        roleFilter={filter('role')}
        setRoleFilter={setFilterValue('role')}
        statusFilter={filter('status')}
        setStatusFilter={setFilterValue('status')}
        canManageUsers={currentUser?.role === 'super_admin'}
        onView={(item: Profile) => setViewingUser(item)}
        onEdit={handleEditUser}
        onDeleteRequest={(item: Profile) => setDeletingUser(item)}
        onChangePassword={(item: Profile) => setChangingPasswordUser(item)}
      />

      {showUserModal && (
        <UserFormModal
          userForm={userForm}
          setUserForm={setUserForm}
          setShowUserModal={setShowUserModal}
          handleCreateUser={handleCreateUser}
          isSubmitting={createUserMutation.isPending}
        />
      )}

      {showEditUserModal && editingUser && (
        <UserEditModal
          editingUser={editingUser}
          userForm={userForm}
          setUserForm={setUserForm}
          setShowEditUserModal={setShowEditUserModal}
          setEditingUser={setEditingUser}
          handleUpdateUser={handleUpdateUser}
          isSubmitting={updateUserMutation.isPending}
        />
      )}

      {changingPasswordUser && (
        <ChangePasswordModal
          targetUser={changingPasswordUser}
          onCancel={() => setChangingPasswordUser(null)}
          onSubmit={handleChangeUserPassword}
          isSubmitting={changeUserPasswordMutation.isPending}
          errorMessage={changeUserPasswordMutation.isError ? 'Failed to change password. Please try again.' : undefined}
        />
      )}

      {viewingUser && <UserViewModal viewingUser={viewingUser} setViewingUser={setViewingUser} />}

      {deletingUser && (
        <UserDeleteConfirmModal
          deletingUser={deletingUser}
          onCancel={() => setDeletingUser(null)}
          onConfirm={(id: string) =>
            deleteUserMutation.mutate(id, {
              onSuccess: () => setDeletingUser(null),
              onError: (err) => console.error('Error deleting user:', err),
            })
          }
          isDeleting={deleteUserMutation.isPending}
        />
      )}
    </>
  );
}
