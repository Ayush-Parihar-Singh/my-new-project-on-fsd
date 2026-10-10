import { z } from "zod";
import { apiRoute, json, parseQuery } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listMyNotifications } from "@/server/services/notification.service";

const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(["1", "0"]).optional(),
});

export const GET = apiRoute(async (req) => {
  const user = await requireUser();
  const q = parseQuery(req, query);
  return json(await listMyNotifications(user.id, q.page, q.pageSize, q.unread === "1"));
});
