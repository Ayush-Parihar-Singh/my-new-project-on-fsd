import { NextResponse, type NextRequest } from "next/server";
import { apiRoute, json } from "@/lib/http";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { UnauthorizedError } from "@/lib/errors";
import { runExpirationSweep } from "@/server/services/expiration.service";

/** Scheduler entry point. Requires `Authorization: Bearer <CRON_SECRET>`. */
export const POST = apiRoute(async (req: NextRequest) => {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.CRON_SECRET || !safeEqual(token, env.CRON_SECRET)) throw new UnauthorizedError("Invalid scheduler credentials.");
  return json(await runExpirationSweep());
});

export const GET = () => NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, { status: 405 });
