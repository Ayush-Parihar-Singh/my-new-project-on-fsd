import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { loginSchema } from "@/validation/auth";
import { login } from "@/server/services/auth.service";

export const POST = apiRoute(async (req) => {
  const input = await readJson(req, loginSchema);
  const user = await login(input, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ user });
});
