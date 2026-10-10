"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, describedBy } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordInput, type ResetPasswordInput } from "@/validation/auth";
import { api } from "@/lib/client/api";

export function ForgotPasswordForm() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [devUrl, setDevUrl] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    const res = await api<{ message: string; devResetUrl?: string }>("POST", "/api/auth/forgot-password", values);
    if (!res.ok) return setServerError(res.message);
    setMessage(res.data.message);
    setDevUrl(res.data.devResetUrl ?? null);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Reset your password</h1>
        <p className="text-muted">Enter the email you registered with. If an account exists, we will send a link that expires in 30 minutes.</p>
      </div>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {message ? (
        <Alert tone="success" title="Check your inbox">
          {message}
          {devUrl ? (
            <span className="mt-2 block break-all text-xs">
              Development only: <a className="font-semibold underline" href={devUrl}>open the reset link</a>
            </span>
          ) : null}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card md:p-8">
          <Field id="email" label="Email" required error={errors.email?.message ? [errors.email.message] : undefined}>
            <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} describedBy={describedBy("email", undefined, errors.email?.message ? [errors.email.message] : undefined)} {...register("email")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-forest hover:underline">Back to sign in</Link></p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: "", confirmPassword: "" } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    const res = await api<{ message: string }>("POST", "/api/auth/reset-password", values);
    if (!res.ok) return setServerError(res.message);
    setDone(res.data.message);
    setTimeout(() => router.replace("/login"), 1500);
  }

  if (!token) {
    return <Alert tone="error" title="This link is incomplete">Request a new reset link from the forgot password page.</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Choose a new password</h1>
        <p className="text-muted">Using the link from your email. Signing in again is required on every device.</p>
      </div>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {done ? <Alert tone="success">{done}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card md:p-8">
        <Field id="password" label="New password" required hint="At least 10 characters, with a letter and a number." error={errors.password?.message ? [errors.password.message] : undefined}>
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} describedBy={describedBy("password", "h", errors.password?.message ? [errors.password.message] : undefined)} {...register("password")} />
        </Field>
        <Field id="confirmPassword" label="Confirm new password" required error={errors.confirmPassword?.message ? [errors.confirmPassword.message] : undefined}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} describedBy={describedBy("confirmPassword", undefined, errors.confirmPassword?.message ? [errors.confirmPassword.message] : undefined)} {...register("confirmPassword")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!!done}>Update password</Button>
      </form>
    </div>
  );
}
