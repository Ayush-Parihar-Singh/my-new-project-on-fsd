import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { listRecipientClaims } from "@/server/services/claim.service";

export const GET = apiRoute(async () => {
  const user = await requireUser(["NGO"]);
  return json(await listRecipientClaims(user));
});
