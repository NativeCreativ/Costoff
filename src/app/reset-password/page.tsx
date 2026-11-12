"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/components/auth/auth.schema";
import { useResetPasswordMutation } from "@/queries/auth/useResetPasswordMutation";

const REDIRECT_DELAY_MS = 1500;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const resetPasswordMutation = useResetPasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState({ newPassword: false, confirmPassword: false });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email, router]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setFormError(null);
    try {
      await resetPasswordMutation.mutateAsync({ email, ...values });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, REDIRECT_DELAY_MS);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to reset password. Please try again.";
      setFormError(message);
    }
  };

  if (!email) return null;

  const busy = isSubmitting || resetPasswordMutation.isPending;

  return (
    <AuthShell
      title="Reset password"
      subtitle={`Set a new password for ${email}`}
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
      {success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[0.82rem] text-green-700">
          Password reset successfully. Redirecting to login…
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] text-red-700">
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#0f172a]">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword.newPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                disabled={busy}
                className="h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 pr-9 text-[0.85rem] shadow-none"
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => ({ ...s, newPassword: !s.newPassword }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                tabIndex={-1}
                aria-label={showPassword.newPassword ? "Hide password" : "Show password"}
              >
                {showPassword.newPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword?.message && (
              <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.newPassword.message}</span>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#0f172a]">
              Confirm New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword.confirmPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                disabled={busy}
                className="h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 pr-9 text-[0.85rem] shadow-none"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => ({ ...s, confirmPassword: !s.confirmPassword }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                tabIndex={-1}
                aria-label={showPassword.confirmPassword ? "Hide password" : "Show password"}
              >
                {showPassword.confirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword?.message && (
              <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.confirmPassword.message}</span>
            )}
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="h-auto w-full rounded-md py-2.5 text-[0.9rem] font-semibold"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Resetting…
              </span>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
