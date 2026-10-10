import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listingAssistSchema } from "@/validation/operations";
import { suggestListing } from "@/server/services/ai.service";

export const POST = apiRoute(async (req) => {
  const user = await requireUser(["DONOR"]);
  const input = await readJson(req, listingAssistSchema);
  return json(await suggestListing(user, { text: input.text, photoIds: input.photoIds ?? [] }));
});
