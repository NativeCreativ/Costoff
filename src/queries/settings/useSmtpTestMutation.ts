import { useMutation } from '@tanstack/react-query';
import { sendTestEmail } from '@/services/smtp.service';

export function useSmtpTestMutation() {
  return useMutation({
    mutationFn: (to: string) => sendTestEmail(to),
  });
}
