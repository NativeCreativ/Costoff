'use client';

import { ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden w-[420px] shrink-0 flex-col justify-between p-10 lg:flex"
        style={{ background: 'var(--sidebar-bg-gradient)' }}
      >
        <span className="font-['Cinzel',serif] text-[1.6rem] font-extrabold tracking-[2px] text-white [text-shadow:0_2px_10px_rgba(255,255,255,0.1)]">
          COSTAFF
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="text-[1.6rem] font-extrabold leading-tight text-white">
            North ATS
          </h1>
          <p className="text-[0.88rem] leading-[1.6] text-[color:var(--sidebar-text)]">
            The Applicant Tracking System for your recruitment operations — demands, candidates, interviews, offers and onboarding in one place.
          </p>
        </div>
        <span className="text-[0.72rem] text-[color:var(--sidebar-text)]">
          © {new Date().getFullYear()} Costaff. All rights reserved.
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--bg-main)] p-6">
        <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white p-8 shadow-[var(--card-shadow)]">
          <div className="mb-6 flex flex-col gap-1 lg:hidden">
            <span className="font-['Cinzel',serif] text-[1.3rem] font-extrabold tracking-[2px] text-[#0f172a]">
              COSTAFF
            </span>
          </div>
          <div className="mb-6">
            <h2 className="text-[1.3rem] font-bold text-[#0f172a]">{title}</h2>
            <p className="mt-1 text-[0.82rem] text-[#64748b]">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-5 text-center text-[0.82rem] text-[#64748b]">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
