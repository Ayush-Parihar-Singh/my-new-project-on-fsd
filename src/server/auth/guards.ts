// Authorization guards. Every sensitive service call starts with one of these.
import { redirect } from "next/navigation";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { Role } from "@/generated/prisma/enums";
import { getSessionUser, type AuthUser } from "./session";

export async function getCurrentUser(): Promise<AuthUser | null> {
  return getSessionUser();
}

/** For Route Handlers and services. Throws 401 / 403. */
export async function requireUser(roles?: Role[]): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

/** For Server Components / layouts. Redirects instead of throwing. */
export async function requirePageUser(roles?: Role[], next?: string): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/login${target}`);
  }
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export function requireVerified(user: AuthUser): void {
  if (user.verificationStatus !== "VERIFIED") {
    throw new AppError(
      user.role === "VOLUNTEER"
        ? "Your volunteer profile must be verified before you can take delivery tasks."
        : "Your organization must be verified before you can do this.",
      403,
      "VERIFICATION_REQUIRED",
    );
  }
}
