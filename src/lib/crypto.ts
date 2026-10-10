// Server-only cryptographic helpers. Session and reset tokens are never stored in plain text.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, purpose: string): string {
  return createHmac("sha256", env.APP_SECRET).update(`${purpose}:${value}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Four-digit handover code shown to the recipient and entered by the volunteer. */
export function generateHandoverCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function hashHandoverCode(donationId: string, code: string): string {
  return hmac(`${donationId}:${code.trim()}`, "handover");
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(`lastplate-encryption:${env.APP_SECRET}`).digest();
}

/** AES-256-GCM. Output format: iv.tag.ciphertext (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, encB] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
}
