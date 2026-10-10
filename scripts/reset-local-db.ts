/**
 * Development helper: drops and recreates the public schema, then applies all SQL migrations.
 * Refuses to run when NODE_ENV=production or APP_ENV=production.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { Client } from "pg";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to reset a production database.");
  }
  const url = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execFileSync("npx", ["tsx", "scripts/apply-sql-migrations.ts"], { stdio: "inherit", env: process.env });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
