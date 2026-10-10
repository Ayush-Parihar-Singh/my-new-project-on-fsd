// Registration, login, logout and password recovery.
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@/validation/auth";
import { createSession, destroyCurrentSession, revokeAllSessions, type AuthUser } from "../auth/session";
import * as users from "../repositories/users.repo";
import { writeAudit } from "../repositories/notifications.repo";
import { sendEmail } from "../integrations/email";

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 30 * 60_000;

let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  // Compared against when the email is unknown, so response timing does not reveal account existence.
  dummyHash ??= bcrypt.hash(randomToken(16), BCRYPT_ROUNDS);
  return dummyHash;
}

export function toAuthUser(u: {
  id: string; email: string; fullName: string; role: AuthUser["role"]; verificationStatus: AuthUser["verificationStatus"];
  isDemo: boolean; onboardedAt: Date | null; phone: string | null;
}): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    verificationStatus: u.verificationStatus,
    isDemo: u.isDemo,
    onboardedAt: u.onboardedAt,
    phone: u.phone,
  };
}

export async function register(input: RegisterInput, meta: { ip: string; userAgent?: string }): Promise<AuthUser> {
  consumeRateLimit(`register:ip:${meta.ip}`, 10, 60 * 60_000);
  const existing = await users.findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError("An account with this email already exists. Try signing in instead.", "EMAIL_TAKEN");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await users.createUser({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    verificationStatus: "NOT_SUBMITTED",
  });
  await createSession(user.id, meta);
  return toAuthUser(user);
}

export async function login(input: LoginInput, meta: { ip: string; userAgent?: string }): Promise<AuthUser> {
  consumeRateLimit(`login:ip:${meta.ip}`, 40, 15 * 60_000);
  consumeRateLimit(`login:email:${input.email}`, 10, 15 * 60_000);

  const user = await users.findUserByEmail(input.email);
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    await writeAudit(db, { action: "auth.login_failed", entityType: "User", entityId: user?.id ?? null, actorEmail: input.email, ip: meta.ip, metadata: { reason: "invalid_credentials" } });
    throw new UnauthorizedError("Email or password is incorrect.");
  }
  if (user.status === "SUSPENDED") {
    throw new ForbiddenError("This account is suspended. Please contact the LastPlate team.");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, meta);
  return toAuthUser(user);
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
}

export async function requestPasswordReset(email: string, meta: { ip: string }) {
  consumeRateLimit(`reset:email:${email}`, 5, 60 * 60_000);
  consumeRateLimit(`reset:ip:${meta.ip}`, 20, 60 * 60_000);

  const user = await users.findUserByEmail(email);
  let devResetUrl: string | undefined;
  if (user && user.status === "ACTIVE") {
    const token = randomToken(32);
    await users.createPasswordReset(user.id, sha256(token), new Date(Date.now() + RESET_TTL_MS));
    const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "LastPlate: reset your password",
      text: `Hello ${user.fullName},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    });
    // Developer convenience only: never returned in production or when email is configured.
    if (env.APP_ENV === "development" && !env.emailEnabled) devResetUrl = link;
  }
  // Same response whether or not the account exists.
  return {
    message: "If an account exists for that email, we have sent password reset instructions.",
    ...(devResetUrl ? { devResetUrl } : {}),
  };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const record = await users.findActivePasswordReset(sha256(input.token));
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.status !== "ACTIVE") {
    throw new BadRequestError("This reset link is invalid or has expired. Please request a new one.");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await db.$transaction(async (tx) => {
    await users.updateUser(record.userId, { passwordHash }, tx);
    await users.markResetUsed(record.id, tx);
    await users.deleteSessionsForUser(record.userId, tx);
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });
  });
  await writeAudit(db, { actorId: record.userId, action: "auth.password_reset", entityType: "User", entityId: record.userId });
  await revokeAllSessions(record.userId);
}
