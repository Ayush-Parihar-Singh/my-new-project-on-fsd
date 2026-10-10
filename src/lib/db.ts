// Prisma client singleton (Prisma 7 + PostgreSQL driver adapter).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { lastplatePrisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.lastplatePrisma ?? createClient();
if (env.APP_ENV !== "production") globalForPrisma.lastplatePrisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
