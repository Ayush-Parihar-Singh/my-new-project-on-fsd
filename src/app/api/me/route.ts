import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";

export const GET = apiRoute(async () => {
  const user = await requireUser();
  return json({ user });
});
