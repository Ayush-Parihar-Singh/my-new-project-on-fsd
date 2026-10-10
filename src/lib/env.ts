import { z } from "zod";

// Server-only. Validated once at startup. Never import from client components.
const boolFromString = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me-0123456789"),
  CRON_SECRET: z.string().default(""),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  SECURE_COOKIES: boolFromString,
  STORAGE_DIR: z.string().default("./storage"),
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(10).default(5),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: boolFromString,
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  EMAIL_FROM: z.string().default("LastPlate <no-reply@lastplate.example>"),
  AI_API_KEY: z.string().default(""),
  AI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  DEMO_PASSWORD: z.string().default("LastPlate-Demo-2026"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

const raw = parsed.data;
const isProduction = raw.APP_ENV === "production";

if (isProduction && raw.APP_SECRET.startsWith("dev-only-insecure")) {
  throw new Error("APP_SECRET must be set to a unique value in production.");
}
if (isProduction && raw.CRON_SECRET.length < 16) {
  throw new Error("CRON_SECRET must be at least 16 characters in production.");
}

export const env = {
  ...raw,
  isProduction,
  secureCookies: isProduction || raw.SECURE_COOKIES,
  emailEnabled: raw.SMTP_HOST.length > 0,
  aiEnabled: raw.AI_API_KEY.length > 0,
  maxUploadBytes: Math.round(raw.MAX_UPLOAD_MB * 1024 * 1024),
};
export type Env = typeof env;
