import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { cancelDonationSchema } from "@/validation/donation";
import { cancelDonation } from "@/server/services/donation.service";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["DONOR"]);
  const { id } = await params;
  const input = await readJson(req, cancelDonationSchema);
  return json({ donation: await cancelDonation(user, id, input.reason) });
});
