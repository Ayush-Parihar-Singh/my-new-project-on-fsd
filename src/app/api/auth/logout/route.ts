import { apiRoute, json } from "@/lib/http";
import { logout } from "@/server/services/auth.service";

export const POST = apiRoute(async () => {
  await logout();
  return json({ ok: true });
});
