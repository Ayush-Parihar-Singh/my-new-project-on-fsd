/**
 * Background sweep for listing expiry, failed handovers and deadline reminders.
 *
 *   npm run worker:expire            # loop forever, every EXPIRY_INTERVAL_SECONDS (default 300)
 *   npm run worker:expire -- --once  # run a single sweep and exit (e.g. from cron)
 *
 * The same sweep also runs opportunistically on public reads (throttled), so this worker
 * is optional but recommended in production. Each item is processed in its own transaction.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { runExpirationSweep } from "../src/server/services/expiration.service";

const intervalSeconds = Math.max(30, Number(process.env.EXPIRY_INTERVAL_SECONDS ?? 300));
const once = process.argv.includes("--once");

async function sweepOnce(): Promise<void> {
  const started = Date.now();
  const result = await runExpirationSweep(new Date());
  const ms = Date.now() - started;
  console.log(
    `[expiry] ${new Date().toISOString()} expired=${result.expired} failedHandovers=${result.failedHandovers} reminders=${result.reminders} errors=${result.errors} (${ms} ms)`,
  );
}

async function main(): Promise<void> {
  if (once) {
    await sweepOnce();
    return;
  }
  console.log(`[expiry] running every ${intervalSeconds}s. Press Ctrl+C to stop.`);
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  while (!stopping) {
    try {
      await sweepOnce();
    } catch (err) {
      // Keep the worker alive; log only the message so no record data leaks into logs.
      console.error(`[expiry] sweep failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, intervalSeconds * 1000));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
