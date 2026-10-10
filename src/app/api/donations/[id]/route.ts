import { apiRoute, json, readJson } from "@/lib/http";
import { getCurrentUser, requireUser } from "@/server/auth/guards";
import { donationWriteSchema } from "@/validation/donation";
import { getDonationForViewer, updateDonation } from "@/server/services/donation.service";

type Params = { id: string };

export const GET = apiRoute<Params>(async (_req, { params }) => {
  const { id } = await params;
  return json({ donation: await getDonationForViewer(await getCurrentUser(), id) });
});

export const PATCH = apiRoute<Params>(async (req, { params }) => {
  const user = await requireUser(["DONOR"]);
  const { id } = await params;
  const input = await readJson(req, donationWriteSchema);
  return json({ donation: await updateDonation(user, id, input) });
});
