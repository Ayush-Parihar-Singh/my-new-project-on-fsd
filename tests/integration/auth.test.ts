import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieJar, fakeCookies } from "../helpers/cookies";

vi.mock("next/headers", () => ({ cookies: async () => fakeCookies }));

import { resetDatabase, uniq } from "../helpers/db";
import { db } from "@/lib/db";
import { register, login, logout, requestPasswordReset, resetPassword } from "@/server/services/auth.service";
import { getSessionUser, SESSION_COOKIE } from "@/server/auth/session";
import { requireUser } from "@/server/auth/guards";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "../helpers/password";
import { resetRateLimits } from "@/lib/rate-limit";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const meta = { ip: "203.0.113.5", userAgent: "vitest" };

beforeAll(async () => {
  await resetDatabase();
});
beforeEach(() => {
  cookieJar.clear();
  resetRateLimits();
});

describe("registration and login", () => {
  it("registers a donor, creates a hashed session and sets an httpOnly cookie", async () => {
    const email = `donor-${uniq()}@example.com`;
    const user = await register(
      { role: "DONOR", fullName: "Asha Rao", email, password: "LongEnough1", acceptTerms: true },
      meta,
    );
    expect(user.role).toBe("DONOR");
    expect(user.verificationStatus).toBe("NOT_SUBMITTED");
    const token = cookieJar.get(SESSION_COOKIE);
    expect(token).toBeTruthy();
    const session = await db.session.findFirst({ where: { userId: user.id } });
    expect(session?.tokenHash).toBe(sha256(token!));
    expect(session?.tokenHash).not.toBe(token);
    const stored = await db.user.findUnique({ where: { id: user.id } });
    expect(stored?.passwordHash).not.toContain("LongEnough1");
  });

  it("refuses duplicate registrations with a generic conflict", async () => {
    const email = `dup-${uniq()}@example.com`;
    await register({ role: "NGO", fullName: "Org One", email, password: "LongEnough1", acceptTerms: true }, meta);
    await expect(
      register({ role: "NGO", fullName: "Org Two", email, password: "LongEnough1", acceptTerms: true }, meta),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("logs in with the right password and rejects the wrong one with the same message for unknown emails", async () => {
    const email = `login-${uniq()}@example.com`;
    await register({ role: "VOLUNTEER", fullName: "Ravi Kumar", email, password: "LongEnough1", acceptTerms: true }, meta);
    await logout();
    const ok = await login({ email, password: "LongEnough1" }, meta);
    expect(ok.email).toBe(email);
    await expect(login({ email, password: "wrong-password-1" }, meta)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(login({ email: `nobody-${uniq()}@example.com`, password: "LongEnough1" }, meta)).rejects.toThrow(
      "Email or password is incorrect.",
    );
  });

  it("locks login attempts per email after repeated failures", async () => {
    const email = `brute-${uniq()}@example.com`;
    await db.user.create({ data: { email, passwordHash: await hashPassword("Right-Pass-1"), fullName: "Brute Target", role: "DONOR" } });
    for (let i = 0; i < 10; i++) {
      await expect(login({ email, password: "Wrong-Pass-1" }, meta)).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(login({ email, password: "Right-Pass-1" }, meta)).rejects.toMatchObject({ status: 429 });
  });
});

describe("sessions and protected routes", () => {
  it("resolves the session user from the cookie and returns null after logout", async () => {
    const email = `sess-${uniq()}@example.com`;
    const u = await register({ role: "DONOR", fullName: "Sess User", email, password: "LongEnough1", acceptTerms: true }, meta);
    expect((await getSessionUser())?.id).toBe(u.id);
    await logout();
    expect(await getSessionUser()).toBeNull();
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects sessions for suspended users and revokes them on suspension", async () => {
    const email = `susp-${uniq()}@example.com`;
    const u = await register({ role: "NGO", fullName: "Susp Org", email, password: "LongEnough1", acceptTerms: true }, meta);
    expect(await getSessionUser()).not.toBeNull();
    await db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    expect(await getSessionUser()).toBeNull();
  });

  it("enforces role checks on the server", async () => {
    const email = `role-${uniq()}@example.com`;
    await register({ role: "DONOR", fullName: "Role Donor", email, password: "LongEnough1", acceptTerms: true }, meta);
    await expect(requireUser(["ADMIN"])).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("password recovery", () => {
  it("answers identically for known and unknown emails and sends no token for unknown ones", async () => {
    const email = `reset-${uniq()}@example.com`;
    await db.user.create({ data: { email, passwordHash: await hashPassword("Old-Pass-123"), fullName: "Reset Me", role: "DONOR" } });
    const known = await requestPasswordReset(email, { ip: "198.51.100.1" });
    const unknown = await requestPasswordReset(`ghost-${uniq()}@example.com`, { ip: "198.51.100.2" });
    expect(known.message).toBe(unknown.message);
    expect(known.devResetUrl).toBeUndefined();
    const tokens = await db.passwordResetToken.count({ where: { user: { email } } });
    expect(tokens).toBe(1);
    const outbox = await db.outboundEmail.findFirst({ where: { toEmail: email, subject: { contains: "reset" } } });
    expect(outbox).not.toBeNull();
  });

  it("accepts a valid single-use token, changes the password and revokes all sessions", async () => {
    const email = `reset2-${uniq()}@example.com`;
    const u = await db.user.create({ data: { email, passwordHash: await hashPassword("Old-Pass-123"), fullName: "Reset Two", role: "DONOR" } });
    await db.session.create({ data: { userId: u.id, tokenHash: sha256("existing-session"), expiresAt: new Date(Date.now() + 86400_000) } });
    const token = "a".repeat(40);
    await db.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });

    await resetPassword({ token, password: "Brand-New-1", confirmPassword: "Brand-New-1" });
    await expect(resetPassword({ token, password: "Another-One-1", confirmPassword: "Another-One-1" })).rejects.toThrow();
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    const fresh = await db.user.findUnique({ where: { id: u.id } });
    const bcrypt = (await import("bcryptjs")).default;
    expect(await bcrypt.compare("Brand-New-1", fresh!.passwordHash)).toBe(true);
  });

  it("rejects expired reset tokens", async () => {
    const u = await db.user.create({ data: { email: `old-${uniq()}@example.com`, passwordHash: "x", fullName: "Old Token", role: "DONOR" } });
    const token = "b".repeat(40);
    await db.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword({ token, password: "Brand-New-1", confirmPassword: "Brand-New-1" })).rejects.toThrow();
  });
});
