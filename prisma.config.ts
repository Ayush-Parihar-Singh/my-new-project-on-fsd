import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env automatically; dotenv is loaded above.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres@localhost:5432/lastplate",
  },
});
