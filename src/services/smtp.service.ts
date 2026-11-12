import { api } from '@/lib/axios';

export interface SmtpTestResult {
  success: boolean;
  simulated?: boolean;
  message: string;
}

export async function sendTestEmail(to: string): Promise<SmtpTestResult> {
  try {
    const { data } = await api.post('/test-email', { to });
    return {
      success: true,
      simulated: data.simulated,
      message: data.message || 'Test email dispatched successfully!',
    };
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || 'Network error occurred while testing SMTP.';
    return { success: false, message };
  }
}
