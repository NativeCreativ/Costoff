import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, updateUser, deleteUser, changeUserPassword, setUserAccess } from '@/services/user.service';
import { UserFormState } from '@/components/users/UserFormModal';

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: UserFormState) => createUser(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: UserFormState }) => updateUser(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useChangeUserPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, newPassword, confirmPassword, oldPassword }: { id: string; newPassword: string; confirmPassword: string; oldPassword?: string }) =>
      changeUserPassword(id, newPassword, confirmPassword, oldPassword),
  });
}

export function useSetUserAccessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blockedModules }: { id: string; blockedModules: string[] }) => setUserAccess(id, blockedModules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}
