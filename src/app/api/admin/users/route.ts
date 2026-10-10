import { z } from "zod";
import { apiRoute, json, parseQuery } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listUsers } from "@/server/services/admin.service";

const query = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["DONOR", "NGO", "VOLUNTEER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = apiRoute(async (req) => {
  const user = await requireUser(["ADMIN"]);
  return json(await listUsers(user, parseQuery(req, query)));
});
