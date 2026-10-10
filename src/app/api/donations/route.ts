import { z } from "zod";
import { apiRoute, json, parseQuery, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { donationWriteSchema } from "@/validation/donation";
import { createDraft, listOwnDonations } from "@/server/services/donation.service";

const listQuery = z.object({
  status: z.enum(["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED", "EXPIRED", "FAILED_HANDOVER"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const GET = apiRoute(async (req) => {
  const user = await requireUser(["DONOR"]);
  const q = parseQuery(req, listQuery);
  return json(await listOwnDonations(user, q));
});

export const POST = apiRoute(async (req) => {
  const user = await requireUser(["DONOR"]);
  const input = await readJson(req, donationWriteSchema);
  return json({ donation: await createDraft(user, input) }, 201);
});
