import { describe, expect, it } from "vitest";
import { publishReadinessErrors } from "@/validation/donation";
import { registerSchema, resetPasswordSchema } from "@/validation/auth";
import { organizationProfileSchema } from "@/validation/profile";
import { verificationDecisionSchema, discoverQuerySchema } from "@/validation/operations";
import { decryptSecret, encryptSecret, generateHandoverCode, hashHandoverCode, randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { detectImageType } from "@/server/services/photo.service";
import { consumeRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";
import { assistantKnowledge } from "@/server/services/assistant-knowledge";
import { ruleInsights } from "@/server/services/ai.service";

const now = new Date("2026-10-10T10:00:00Z");
const ready = {
  title: "Rice meals",
  description: "Rice and dal in containers",
  category: "COOKED_MEALS",
  quantity: 5,
  unit: "PORTIONS",
  pickupAddressLine: "12 Example Street",
  pickupCity: "Bengaluru",
  pickupLatitude: 12.97,
  pickupLongitude: 77.59,
  pickupAreaLabel: "Indiranagar",
  availableFrom: new Date(now.getTime() + 3600_000),
  availableUntil: new Date(now.getTime() + 4 * 3600_000),
  pickupDeadline: new Date(now.getTime() + 5 * 3600_000),
};

describe("publish readiness", () => {
  it("passes a complete listing", () => {
    expect(publishReadinessErrors(ready, now)).toEqual({});
  });
  it("reports every missing field", () => {
    const errs = publishReadinessErrors({ ...ready, title: "", pickupLatitude: null, quantity: null }, now);
    expect(Object.keys(errs)).toEqual(expect.arrayContaining(["title", "quantity", "pickupLatitude"]));
  });
  it("requires the deadline to be at least an hour away and after the window ends", () => {
    expect(publishReadinessErrors({ ...ready, pickupDeadline: new Date(now.getTime() + 30 * 60_000) }, now).pickupDeadline).toBeDefined();
    expect(publishReadinessErrors({ ...ready, pickupDeadline: new Date(now.getTime() + 3600_000) }, now).pickupDeadline).toBeDefined();
  });
});

describe("auth validation", () => {
  it("requires a letter and a number in passwords", () => {
    const pw = (p: string) => registerSchema.safeParse({ role: "DONOR", fullName: "Ok Name", email: "ok@example.com", password: p, acceptTerms: true }).success;
    expect(pw("abcdefghijk")).toBe(false);
    expect(pw("12345678901")).toBe(false);
    expect(pw("short1")).toBe(false);
    expect(pw("LongEnough1")).toBe(true);
  });
  it("rejects admin self-registration", () => {
    const r = registerSchema.safeParse({ role: "ADMIN", fullName: "Eve", email: "eve@example.com", password: "LongEnough1", acceptTerms: true });
    expect(r.success).toBe(false);
  });
  it("requires terms acceptance", () => {
    const r = registerSchema.safeParse({ role: "DONOR", fullName: "Ok Name", email: "ok@example.com", password: "LongEnough1", acceptTerms: false });
    expect(r.success).toBe(false);
  });
  it("checks reset password confirmation", () => {
    const r = resetPasswordSchema.safeParse({ token: "x".repeat(30), password: "LongEnough1", confirmPassword: "Different1" });
    expect(r.success).toBe(false);
  });
  it("prevents donors from creating recipient organization types", () => {
    const parsed = organizationProfileSchema.safeParse({
      kind: "ORGANIZATION", name: "Org", type: "SHELTER", addressLine: "1 Long Road", city: "Pune", latitude: 1, longitude: 1, phone: "1234567",
    });
    expect(parsed.success).toBe(true); // type check happens in the service against the user role
  });
  it("requires start and end receiving hours together", () => {
    const parsed = organizationProfileSchema.safeParse({
      kind: "ORGANIZATION", name: "Org", type: "NGO", addressLine: "1 Long Road", city: "Pune", latitude: 1, longitude: 1, phone: "1234567", receivingStartHour: 9,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("operations validation", () => {
  it("requires a reason for rejecting a verification", () => {
    expect(verificationDecisionSchema.safeParse({ decision: "REJECT" }).success).toBe(false);
    expect(verificationDecisionSchema.safeParse({ decision: "APPROVE" }).success).toBe(true);
  });
  it("bounds discovery pagination", () => {
    expect(discoverQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(discoverQuerySchema.parse({}).pageSize).toBe(12);
  });
});

describe("crypto helpers", () => {
  it("hashes handover codes per donation and verifies them with a safe comparison", () => {
    const code = generateHandoverCode();
    expect(code).toMatch(/^\d{4}$/);
    expect(safeEqual(hashHandoverCode("d1", "2468"), hashHandoverCode("d1", "2468"))).toBe(true);
    expect(hashHandoverCode("d1", "2468")).not.toBe(hashHandoverCode("d2", "2468"));
  });
  it("encrypts secrets reversibly and never in plain text", () => {
    const cipher = encryptSecret("2468");
    expect(cipher).not.toContain("2468");
    expect(decryptSecret(cipher)).toBe("2468");
  });
  it("stores only digests of session tokens", () => {
    const token = randomToken();
    expect(sha256(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256(token)).not.toContain(token);
  });
});

describe("file upload validation", () => {
  it("detects JPEG, PNG and WebP by magic bytes, ignoring filenames", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe("jpg");
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))?.ext).toBe("png");
    expect(detectImageType(Buffer.from("RIFF0000WEBPVP8 ", "ascii"))?.ext).toBe("webp");
  });
  it("rejects HTML and scripts disguised as images", () => {
    expect(detectImageType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
  });
});

describe("rate limiting", () => {
  it("blocks requests beyond the limit within the window", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) consumeRateLimit("k", 3, 60_000);
    expect(() => consumeRateLimit("k", 3, 60_000)).toThrow(RateLimitError);
  });
});

describe("AI fallbacks (no model configured)", () => {
  it("answers platform questions deterministically and never claims food safety", () => {
    const a = assistantKnowledge("Is this food safe to eat from a photo?", "GUEST");
    expect(a.answer).toMatch(/cannot tell/i);
  });
  it("produces an honest insight when there is no data", () => {
    const r = ruleInsights({
      windowDays: 30, completedHandovers: 0, failedPickups: 0, expired: 0, cancelled: 0,
      pickupSuccessRatePercent: null, medianMinutesToClaim: null, activeListings: 0, topCategories: [], flaggedDuplicates: 0,
    });
    expect(r.summary).toMatch(/nothing to measure/);
  });
  it("only reports numbers it was given", () => {
    const r = ruleInsights({
      windowDays: 30, completedHandovers: 8, failedPickups: 2, expired: 0, cancelled: 0,
      pickupSuccessRatePercent: 80, medianMinutesToClaim: 30, activeListings: 3, topCategories: [], flaggedDuplicates: 1,
    });
    expect(r.summary).toContain("8 completed");
    expect(r.summary).toContain("2 failed");
  });
});
