/** Only allow same-site relative redirects, so `next` cannot send users to another website. */
export function safeNext(value: string | undefined | null, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
