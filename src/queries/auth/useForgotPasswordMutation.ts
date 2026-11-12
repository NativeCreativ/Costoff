import { useMutation } from '@tanstack/react-query';
import { verifyForgotPasswordEmail } from '@/services/auth.service';

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: verifyForgotPasswordEmail,
  });
}
