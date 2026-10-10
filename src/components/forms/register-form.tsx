"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HandPlatter, HeartHandshake, Truck, Check } from "lucide-react";
import { Field, Input, Checkbox, describedBy } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { registerSchema, type RegisterInput } from "@/validation/auth";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Role = "DONOR" | "NGO" | "VOLUNTEER";
const roles: { value: Role; title: string; body: string; icon: typeof HandPlatter }[] = [
  { value: "DONOR", title: "Food donor", body: "Restaurants, hotels, cafés, hostels, event teams", icon: HandPlatter },
  { value: "NGO", title: "Recipient", body: "Nonprofits, shelters, community kitchens", icon: HeartHandshake },
  { value: "VOLUNTEER", title: "Volunteer", body: "Pick up and deliver food nearby", icon: Truck },
];

export function RegisterForm({ initialRole }: { initialRole?: Role }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole ?? "DONOR", fullName: "", email: "", password: "", acceptTerms: false as unknown as true },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;
  const role = watch("role");

  const onSubmit: SubmitHandler<RegisterInput> = async (values) => {
    setServerError(null);
    const res = await api("POST", "/api/auth/register", values);
    if (!res.ok) {
      setServerError(res.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  const err = (k: keyof RegisterInput) => (errors[k]?.message ? [errors[k]!.message as string] : undefined);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Join LastPlate</h1>
        <p className="text-muted">Create your account, then tell us about your organization or volunteer profile.</p>
      </div>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card md:p-8">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-deep">How will you take part?</legend>
          <div className="grid gap-3" role="radiogroup" aria-label="Role">
            {roles.map((r) => {
              const Icon = r.icon;
              const selected = role === r.value;
              return (
                <label
                  key={r.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors",
                    selected ? "border-forest bg-forest-50 ring-2 ring-forest/20" : "border-line hover:border-forest/40",
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={r.value}
                    checked={selected}
                    onChange={() => setValue("role", r.value, { shouldValidate: true })}
                  />
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", selected ? "bg-forest text-white" : "bg-sage text-forest")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-deep">{r.title}</span>
                    <span className="block text-xs text-muted">{r.body}</span>
                  </span>
                  {selected ? <Check className="size-5 text-forest" aria-hidden /> : null}
                </label>
              );
            })}
          </div>
          {errors.role ? <p className="text-xs font-medium text-destructive">{errors.role.message}</p> : null}
        </fieldset>

        <Field id="fullName" label="Your full name" required error={err("fullName")}>
          <Input id="fullName" autoComplete="name" invalid={!!errors.fullName} describedBy={describedBy("fullName", undefined, err("fullName"))} {...register("fullName")} />
        </Field>
        <Field id="email" label="Work email" required error={err("email")}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" invalid={!!errors.email} describedBy={describedBy("email", undefined, err("email"))} {...register("email")} />
        </Field>
        <Field id="password" label="Password" required hint="At least 10 characters, with a letter and a number." error={err("password")}>
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} describedBy={describedBy("password", "x", err("password"))} {...register("password")} />
        </Field>
        <div className={cn("rounded-xl border p-4", errors.acceptTerms ? "border-red-200" : "border-line")}>
          <Checkbox
            id="acceptTerms"
            label="I agree to the community guidelines"
            description="Food safety stays with the people handling the food. LastPlate shares information, not safety judgments."
            {...register("acceptTerms")}
          />
          {errors.acceptTerms ? <p className="mt-2 text-xs font-medium text-destructive">{errors.acceptTerms.message}</p> : null}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-forest hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
