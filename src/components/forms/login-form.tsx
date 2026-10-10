"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, describedBy } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { loginSchema, type LoginInput } from "@/validation/auth";
import { api } from "@/lib/client/api";

export interface DemoAccount {
  label: string;
  email: string;
}

export function LoginForm({ next, demoAccounts, demoPassword }: { next: string; demoAccounts: DemoAccount[]; demoPassword: string | null }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const res = await api("POST", "/api/auth/login", values);
    if (!res.ok) {
      setServerError(res.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Welcome back</h1>
        <p className="text-muted">Sign in to manage donations, claims and deliveries.</p>
      </div>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card md:p-8">
        <Field id="email" label="Email" required error={errors.email?.message ? [errors.email.message] : undefined}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" invalid={!!errors.email} describedBy={describedBy("email", undefined, errors.email?.message ? [errors.email.message] : undefined)} {...register("email")} />
        </Field>
        <Field id="password" label="Password" required error={errors.password?.message ? [errors.password.message] : undefined}>
          <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} describedBy={describedBy("password", undefined, errors.password?.message ? [errors.password.message] : undefined)} {...register("password")} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="font-semibold text-forest hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted">
          New to LastPlate?{" "}
          <Link href="/register" className="font-semibold text-forest hover:underline">Create an account</Link>
        </p>
      </form>
      {demoAccounts.length > 0 ? (
        <section aria-labelledby="demo-title" className="rounded-2xl border border-dashed border-forest/30 bg-white/70 p-5 text-sm">
          <h2 id="demo-title" className="font-display text-base font-bold text-deep">Demo accounts (fictional data)</h2>
          <p className="mt-1 text-muted">
            For evaluation only. Password for every demo account: <code className="rounded bg-sage/60 px-1.5 py-0.5 font-mono text-deep">{demoPassword}</code>
          </p>
          <ul className="mt-3 divide-y divide-line">
            {demoAccounts.map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-ink">{a.label}</span>
                <button
                  type="button"
                  className="truncate rounded-md px-2 py-1 font-mono text-xs text-forest hover:bg-forest-50"
                  onClick={() => form.setValue("email", a.email, { shouldValidate: false })}
                >
                  {a.email}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
