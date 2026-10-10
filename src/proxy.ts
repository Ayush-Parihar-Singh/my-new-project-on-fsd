// Edge-of-app guard (Next.js 16 "proxy"). It is a fast first line of defence only:
// every service still re-checks authentication, role and ownership on the server.
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";

const PROTECTED_PAGES = ["/dashboard", "/donations", "/claims", "/deliveries", "/admin", "/notifications", "/profile"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_COOKIE = "lp_session";

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The browser origin a legitimate same-site request carries. Honors a single trusted proxy hop. */
function expectedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>([new URL(env.APP_URL).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  return allowed;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (MUTATING.has(req.method)) {
      // CSRF defence in depth on top of SameSite=Lax cookies: a browser-sent Origin must match this app.
      const origin = req.headers.get("origin");
      if (origin && !expectedOrigins(req).has(origin)) {
        return NextResponse.json({ error: { code: "FORBIDDEN_ORIGIN", message: "This request came from an unexpected website." } }, { status: 403 });
      }
      // Coarse per-client throttle for all writes. Endpoints add stricter limits of their own.
      const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
      try {
        consumeRateLimit(`api-write:${ip}`, 240, 60_000);
      } catch (error) {
        if (error instanceof RateLimitError) {
          return NextResponse.json({ error: { code: "RATE_LIMITED", message: "You are going too fast. Please wait a moment." } }, { status: 429, headers: { "Retry-After": "60" } });
        }
        throw error;
      }
    }
    return NextResponse.next();
  }

  if (isProtectedPage(pathname) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|fonts/).*)"],
};
