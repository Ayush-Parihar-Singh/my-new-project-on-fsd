import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { reportSchema } from "@/validation/operations";
import { reportDonation } from "@/server/services/admin.service";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await readJson(req, reportSchema);
  return json(await reportDonation(user, id, input.reason));
});
