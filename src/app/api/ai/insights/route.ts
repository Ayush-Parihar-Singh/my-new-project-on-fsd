import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { generateInsights } from "@/server/services/ai.service";

export const GET = apiRoute(async () => {
  await requireUser(["ADMIN"]);
  return json(await generateInsights());
});
