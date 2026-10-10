import { apiRoute, json, parseQuery } from "@/lib/http";
import { getCurrentUser } from "@/server/auth/guards";
import { discoverQuerySchema } from "@/validation/operations";
import { discoverDonations } from "@/server/services/discovery.service";

export const GET = apiRoute(async (req) => {
  const q = parseQuery(req, discoverQuerySchema);
  return json(await discoverDonations(await getCurrentUser(), q));
});
