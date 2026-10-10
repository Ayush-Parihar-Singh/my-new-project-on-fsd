import { RegisterForm } from "@/components/forms/register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const initial = role === "NGO" || role === "VOLUNTEER" ? role : role === "DONOR" ? "DONOR" : undefined;
  return <RegisterForm initialRole={initial} />;
}
