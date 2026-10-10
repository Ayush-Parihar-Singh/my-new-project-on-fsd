import Link from "next/link";
import { cn } from "@/lib/utils";

/** Plate-and-leaf mark. Decorative; the wordmark carries the name. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9 shrink-0", className)}>
      <rect width="40" height="40" rx="12" fill="#245C45" />
      <circle cx="20" cy="22" r="10" fill="#FAF8F2" />
      <circle cx="20" cy="22" r="6.5" fill="#DCE8D8" />
      <path d="M24.5 9.5c3.5 0.5 5.5 3.2 5 6.8-3.5-0.4-5.4-2.9-5-6.8z" fill="#E98770" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none", className)} aria-label="LastPlate home">
      <LogoMark />
      {compact ? null : <span className="font-display text-xl font-extrabold tracking-tight text-deep">LastPlate</span>}
    </Link>
  );
}
