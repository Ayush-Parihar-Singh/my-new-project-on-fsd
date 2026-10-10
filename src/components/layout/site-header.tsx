import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogIn } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";
import { ROLE_LABELS } from "@/lib/constants";
import type { AuthUser } from "@/server/auth/session";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/discover", label: "Find food" },
  { href: "/#impact", label: "Impact" },
  { href: "/#partners", label: "Partners" },
];

export function SiteHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-sage/60 hover:text-deep">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard" variant="outline" size="sm">
              <LayoutDashboard /> Dashboard
            </ButtonLink>
          ) : (
            <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-forest hover:bg-forest-50 sm:inline-flex">
              <LogIn className="mr-1.5 size-4" aria-hidden /> Sign in
            </Link>
          )}
          <Link href={user?.role === "DONOR" ? "/donations/new" : "/register"} className="inline-flex h-9 items-center justify-center rounded-full bg-coral px-4 text-sm font-semibold text-deep shadow-sm transition-colors hover:bg-[#dd7860]">
            {user?.role === "DONOR" ? "Post a donation" : "Donate Surplus Food"}
          </Link>
          <details className="group relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-white text-deep" aria-label="Open menu">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-lift">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-sage/50">
                  {l.label}
                </Link>
              ))}
              {!user ? (
                <Link href="/login" className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-forest hover:bg-sage/50">
                  Sign in
                </Link>
              ) : (
                <p className="px-3 py-2 text-xs text-muted">Signed in as {ROLE_LABELS[user.role]}</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
