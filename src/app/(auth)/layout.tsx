import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { getCurrentUser } from "@/server/auth/guards";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="text-sm font-medium text-forest hover:underline">Back to home</Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 md:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
