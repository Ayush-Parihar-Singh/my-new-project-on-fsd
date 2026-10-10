import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { verificationDecisionSchema } from "@/validation/operations";
import { decideVerification } from "@/server/services/admin.service";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["ADMIN"]);
  const { id } = await params;
  const input = await readJson(req, verificationDecisionSchema);
  return json(await decideVerification(user, id, input.decision, input.note ?? null, clientIp(req)));
});
