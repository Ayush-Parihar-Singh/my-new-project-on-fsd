import { apiRoute, clientIp, json, readJson } from "@/lib/http";
import { registerSchema } from "@/validation/auth";
import { register } from "@/server/services/auth.service";

export const POST = apiRoute(async (req) => {
  const input = await readJson(req, registerSchema);
  const user = await register(input, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ user }, 201);
});
