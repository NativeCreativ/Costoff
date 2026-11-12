import { api } from '@/lib/axios';
import { Profile } from '@/components/types';

export async function getCurrentUser(): Promise<Profile | null> {
  const { data } = await api.get('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function verifyForgotPasswordEmail(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(params: {
  email: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await api.post('/auth/reset-password', params);
}
