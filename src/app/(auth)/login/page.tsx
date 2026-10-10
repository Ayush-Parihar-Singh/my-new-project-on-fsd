import { env } from "@/lib/env";
import { LoginForm, type DemoAccount } from "@/components/forms/login-form";
import { safeNext } from "@/components/forms/safe-next";

export const metadata = { title: "Sign in" };

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Admin", email: "admin@lastplate-demo.test" },
  { label: "Donor · Spice Route Kitchen", email: "kitchen@spiceroute.lastplate-demo.test" },
  { label: "Recipient · Ashani Night Shelter", email: "intake@ashanightshelter.lastplate-demo.test" },
  { label: "Volunteer · Ravi", email: "ravi@lastplate-demo.test" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Demo credentials are shown only outside production.
  const showDemo = !env.isProduction;
  return (
    <LoginForm
      next={safeNext(next)}
      demoAccounts={showDemo ? DEMO_ACCOUNTS : []}
      demoPassword={showDemo ? env.DEMO_PASSWORD : null}
    />
  );
}
