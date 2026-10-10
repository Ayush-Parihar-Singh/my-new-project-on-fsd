import type { AuthUser } from "../auth/session";
import type { Viewer } from "@/domain/visibility";

export function viewerOf(user: AuthUser | null): Viewer {
  return user ? { id: user.id, role: user.role, verificationStatus: user.verificationStatus } : null;
}
