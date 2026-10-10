import { z } from "zod";
import { apiRoute, json, parseQuery } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { adminOverview } from "@/server/services/analytics.service";

const query = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

export const GET = apiRoute(async (req) => {
  await requireUser(["ADMIN"]);
  const { days } = parseQuery(req, query);
  return json(await adminOverview(days));
});
