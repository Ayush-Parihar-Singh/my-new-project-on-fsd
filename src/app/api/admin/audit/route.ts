import { z } from "zod";
import { apiRoute, json, parseQuery } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listAudit } from "@/server/services/admin.service";

const query = z.object({
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = apiRoute(async (req) => {
  await requireUser(["ADMIN"]);
  return json(await listAudit(parseQuery(req, query)));
});
