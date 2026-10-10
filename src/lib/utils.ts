import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTime.format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateOnly.format(new Date(value));
}

/** "in 2 h", "5 min ago". Uses the server-safe Intl API; never throws on bad input. */
export function relativeTime(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const diffMs = new Date(value).getTime() - now;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const label =
    mins < 1 ? "now" : mins < 60 ? `${mins} min` : mins < 60 * 48 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
  if (label === "now") return "now";
  return diffMs >= 0 ? `in ${label}` : `${label} ago`;
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
