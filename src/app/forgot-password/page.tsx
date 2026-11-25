"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Forgot password — there is no self-service reset (security fix, 25 Nov 2026): the app cannot
 * email a reset link, and resetting by email address alone let anyone take over any account.
 * The Delivery Head resets a forgotten password from the Users page.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Your Delivery Head can reset it for you"
      footer={
        <>
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-[color:var(--primary-blue)] hover:text-[color:var(--primary-blue-hover)] hover:underline"
          >
            Back to login
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-[0.85rem] text-[#334155]">
        <p>For security, passwords can&apos;t be reset from this page.</p>
        <p>
          Ask your <strong>Delivery Head</strong> (the app admin) to set a new password for you from the{" "}
          <strong>Users</strong> page. Once you&apos;re signed in, you can change it to one of your own there.
        </p>
      </div>
    </AuthShell>
  );
}
