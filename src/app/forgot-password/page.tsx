"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/components/auth/auth.schema";
import { useForgotPasswordMutation } from "@/queries/auth/useForgotPasswordMutation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgotPasswordMutation = useForgotPasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setFormError(null);
    try {
      await forgotPasswordMutation.mutateAsync(values.email);
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "We couldn't verify that email. Please try again.";
      setFormError(message);
    }
  };

  const busy = isSubmitting || forgotPasswordMutation.isPending;

  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Enter your email address and we'll verify your account"
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] text-red-700">
            {formError}
          </div>
        )}
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#0f172a]">
            Email Address
          </label>
          <Input
            type="email"
            placeholder="e.g. admin@costaff.com"
            autoFocus
            disabled={busy}
            className="h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
            {...register("email")}
          />
          {errors.email?.message && (
            <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.email.message}</span>
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
              Verifying…
            </span>
          ) : (
            "Verify Email"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
