import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { profileSchema } from "@/validation/profile";
import { saveProfile } from "@/server/services/onboarding.service";

export const PUT = apiRoute(async (req) => {
  const user = await requireUser();
  const input = await readJson(req, profileSchema);
  return json(await saveProfile(user, input));
});
