import { apiRoute, json } from "@/lib/http";
import { publicImpact } from "@/server/services/analytics.service";

export const GET = apiRoute(async () => {
  return json(await publicImpact());
});
