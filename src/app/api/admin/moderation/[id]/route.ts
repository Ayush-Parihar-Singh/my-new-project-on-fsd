import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { moderationActionSchema } from "@/validation/operations";
import { moderate } from "@/server/services/admin.service";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  const input = await readJson(req, moderationActionSchema);
  return json(await moderate(user, input, id, clientIp(req)));
});
