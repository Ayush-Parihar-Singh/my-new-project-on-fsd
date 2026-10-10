import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listModerationQueue } from "@/server/services/admin.service";

export const GET = apiRoute(async () => {
  const user = await requireUser(["ADMIN"]);
  return json(await listModerationQueue(user));
});
