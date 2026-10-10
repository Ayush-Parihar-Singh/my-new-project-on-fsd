import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { publishSchema } from "@/validation/donation";
import { publishDonation } from "@/server/services/donation.service";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["DONOR"]);
  const { id } = await params;
  const input = await readJson(req, publishSchema);
  return json(await publishDonation(user, id, input.acknowledgeDuplicate));
});
