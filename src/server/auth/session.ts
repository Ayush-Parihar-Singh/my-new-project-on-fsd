// Session management: opaque random tokens in httpOnly cookies; only SHA-256 hashes are stored.
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import type { Role, VerificationStatus } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "lp_session";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  onboardedAt: Date | null;
  phone: string | null;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  verificationStatus: true,
  isDemo: true,
  onboardedAt: true,
  phone: true,
  status: true,
} as const;

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 3600_000);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ip: meta.ip?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 200),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, user: { select: userSelect } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  const { status: _status, ...user } = session.user;
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
