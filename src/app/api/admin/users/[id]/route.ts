import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { userStatusSchema } from "@/validation/operations";
import { setUserStatus } from "@/server/services/admin.service";

export const PATCH = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  const input = await readJson(req, userStatusSchema);
  return json(await setUserStatus(user, id, input.status, input.reason, clientIp(req)));
});
