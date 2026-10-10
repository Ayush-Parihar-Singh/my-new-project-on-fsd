import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { markAllRead } from "@/server/services/notification.service";

export const POST = apiRoute(async () => {
  const user = await requireUser();
  await markAllRead(user.id);
  return json({ ok: true });
});
