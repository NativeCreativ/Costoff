"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  loginSchema,
  type LoginFormValues,
} from "@/components/auth/auth.schema";
import { api } from "@/lib/axios";
import { queryKeys } from "@/lib/queryKeys";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Set once login succeeds; keeps a full-page loader up so the login form/redirect
  // race never shows through before the dashboard is actually ready.
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current != null) window.clearTimeout(redirectTimer.current);
    };
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await api.post("/auth/login", values);
      try {
        const me = await api.get("/auth/me");
        if (!me.data?.user) {
          setFormError("Signed in, but this browser did not keep the session, so the dashboard could not open. Reload and try again.");
          return;
        }
      } catch {
        setFormError("Signed in, but this browser did not keep the session, so the dashboard could not open. Reload and try again.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
      setRedirecting(true);
      router.push("/");
      router.refresh();
      // If the dashboard bounces back to this page without remounting, the loader
      // would otherwise stay up. Return to the form once that is clear.
      redirectTimer.current = window.setTimeout(() => {
        if (window.location.pathname === "/login") {
          setRedirecting(false);
          setFormError("The dashboard did not open. Reload the page and try again.");
        }
      }, 4000);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to log in. Please try again.";
      setFormError(message);
    }
  };

  if (redirecting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-[color:var(--primary-blue)]"></i>
          <p className="text-[0.9rem] font-semibold text-[#475569]">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your ATS dashboard"
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
            className="h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
            {...register("email")}
          />
          {errors.email?.message && (
            <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.email.message}</span>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#0f172a]">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 pr-9 text-[0.85rem] shadow-none"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password?.message && (
            <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{errors.password.message}</span>
          )}
        </div>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[0.8rem] font-semibold text-[color:var(--primary-blue)] hover:text-[color:var(--primary-blue-hover)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-auto w-full rounded-md py-2.5 text-[0.9rem] font-semibold"
        >
          {isSubmitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}
