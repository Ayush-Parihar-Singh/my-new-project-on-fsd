/**
 * Applies prisma/migrations/*\/migration.sql in order, recording each in
 * "_lastplate_sql_migrations". Use `prisma migrate deploy` whenever the Prisma
 * schema engine is available; this script is the fallback for constrained
 * environments (e.g. CI sandboxes that cannot download Prisma engines).
 */
import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const dir = join(process.cwd(), "prisma", "migrations");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS "_lastplate_sql_migrations" (
         "name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`,
    );
    const names = readdirSync(dir)
      .filter((n) => existsSync(join(dir, n, "migration.sql")))
      .sort();
    for (const name of names) {
      const done = await client.query(`SELECT 1 FROM "_lastplate_sql_migrations" WHERE "name" = $1`, [name]);
      if (done.rowCount) {
        console.log(`skip  ${name}`);
        continue;
      }
      const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO "_lastplate_sql_migrations" ("name") VALUES ($1)`, [name]);
        await client.query("COMMIT");
        console.log(`apply ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
