import { z } from "zod";
import { apiRoute, json, parseQuery } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listVerifications } from "@/server/services/admin.service";

const query = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = apiRoute(async (req) => {
  await requireUser(["ADMIN"]);
  const q = parseQuery(req, query);
  return json(await listVerifications(q.status, q.page, q.pageSize));
});
