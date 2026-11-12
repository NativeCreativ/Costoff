'use client';

import { Input } from '@/components/ui/input';

interface SmtpTestResult {
  success: boolean;
  simulated?: boolean;
  message: string;
}

interface SettingsSmtpProps {
  smtpTestEmail: string;
  setSmtpTestEmail: (v: string) => void;
  smtpTesting: boolean;
  smtpTestResult: SmtpTestResult | null;
  handleTestSmtp: (e: React.FormEvent) => void;
}

export function SettingsSmtp({ smtpTestEmail, setSmtpTestEmail, smtpTesting, smtpTestResult, handleTestSmtp }: SettingsSmtpProps) {
  const resultColorClass = smtpTestResult
    ? smtpTestResult.success
      ? smtpTestResult.simulated
        ? 'bg-[#fef3c7] border-[#fde68a] text-[#92400e]'
        : 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
      : 'bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]'
    : '';

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <i className="fa-solid fa-paper-plane text-[#2563eb]"></i> SMTP Mail Delivery Diagnostics
        </h2>
        <p className="mb-4 text-[0.82rem] leading-[1.4] text-[#64748b]">
          Test your SMTP connection and live email dispatch. When SMTP credentials are saved in <code>.env.local</code>, emails will be delivered directly to the target inbox.
        </p>

        <form onSubmit={handleTestSmtp} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">
              Recipient Email Address
            </label>
            <Input
              type="email"
              placeholder="e.g. admin@costaff.com"
              value={smtpTestEmail}
              onChange={(e) => setSmtpTestEmail(e.target.value)}
              required
              className="h-auto w-full rounded-md border-[#cbd5e1] px-3 py-2.5 text-[0.85rem] shadow-none transition-all duration-200 focus-visible:border-[#3b82f6] focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] focus-visible:ring-0"
            />
          </div>

          <button
            type="submit"
            disabled={smtpTesting}
            className={`inline-flex items-center justify-center gap-2 rounded-md border-none px-[18px] py-2.5 text-[0.85rem] font-semibold text-white ${smtpTesting ? 'cursor-not-allowed bg-[#94a3b8]' : 'cursor-pointer bg-[#2563eb]'}`}
          >
            {smtpTesting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Dispatching Test Mail...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i> Send Test Email
              </>
            )}
          </button>
        </form>

        {smtpTestResult && (
          <div className={`mt-4 rounded-lg border px-3.5 py-3 text-[0.82rem] ${resultColorClass}`}>
            <div className="mb-1 flex items-center gap-1.5 font-bold">
              {smtpTestResult.success ? (
                smtpTestResult.simulated ? (
                  <><i className="fa-solid fa-triangle-exclamation"></i> Simulated Mode Active</>
                ) : (
                  <><i className="fa-solid fa-circle-check"></i> SMTP Test Successful!</>
                )
              ) : (
                <><i className="fa-solid fa-circle-xmark"></i> SMTP Connection Error</>
              )}
            </div>
            <div>{smtpTestResult.message}</div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <i className="fa-solid fa-gears text-[#64748b]"></i> SMTP Environment Variables Setup
        </h2>
        <p className="mb-3.5 text-[0.82rem] leading-[1.4] text-[#64748b]">
          To switch from <strong>Simulated Console Mode</strong> to <strong>Live Mail Delivery</strong>, add the following variables into <code>.env.local</code> in your project root:
        </p>

        <div className="rounded-lg bg-[#0f172a] p-3.5 font-mono text-[0.78rem] leading-[1.6] text-[#f8fafc]">
          <div className="text-[#64748b]"># SMTP Mail Engine Configuration</div>
          <div>SMTP_HOST=<span className="text-[#38bdf8]">smtp.gmail.com</span></div>
          <div>SMTP_PORT=<span className="text-[#f59e0b]">587</span></div>
          <div>SMTP_USER=<span className="text-[#4ade80]">your-email@gmail.com</span></div>
          <div>SMTP_PASS=<span className="text-[#f43f5e]">your-app-password</span></div>
          <div>SMTP_FROM=<span className="text-[#cbd5e1]">"Costaff ATS" &lt;your-email@gmail.com&gt;</span></div>
        </div>
      </div>
    </div>
  );
}
