import { apiRoute, json, readJson } from "@/lib/http";
import { getCurrentUser } from "@/server/auth/guards";
import { assistantSchema } from "@/validation/operations";
import { assistantAnswer } from "@/server/services/ai.service";

export const POST = apiRoute(async (req) => {
  const user = await getCurrentUser();
  const input = await readJson(req, assistantSchema);
  return json(await assistantAnswer(user, input.message));
});
