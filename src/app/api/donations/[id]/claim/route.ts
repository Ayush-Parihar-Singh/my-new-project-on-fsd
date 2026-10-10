import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { claimDonation } from "@/server/services/claim.service";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser(["NGO"]);
  const { id } = await params;
  return json(await claimDonation(user, id));
});
