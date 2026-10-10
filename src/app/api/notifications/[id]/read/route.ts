import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { markRead } from "@/server/services/notification.service";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await markRead(user.id, id);
  return json({ ok: true });
});
