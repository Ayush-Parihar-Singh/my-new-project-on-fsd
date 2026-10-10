import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { volunteerBoard } from "@/server/services/delivery.service";

export const GET = apiRoute(async () => {
  const user = await requireUser(["VOLUNTEER"]);
  return json(await volunteerBoard(user));
});
