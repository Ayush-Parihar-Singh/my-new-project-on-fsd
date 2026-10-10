import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { forgotPasswordSchema } from "@/validation/auth";
import { requestPasswordReset } from "@/server/services/auth.service";

export const POST = apiRoute(async (req) => {
  const input = await readJson(req, forgotPasswordSchema);
  return json(await requestPasswordReset(input.email, { ip: clientIp(req) }));
});
