import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { claimNoteSchema } from "@/validation/operations";
import { confirmClaim, declineClaim, withdrawClaim } from "@/server/services/claim.service";
import { BadRequestError } from "@/lib/errors";

/** Donor confirms or declines a request; the recipient withdraws their own request. */
export const POST = apiRoute<{ id: string; action: string }>(async (req, { params }) => {
  const { id, action } = await params;
  if (!["confirm", "decline", "withdraw"].includes(action)) throw new BadRequestError("Unknown claim action.");
  const user = await requireUser(action === "withdraw" ? ["NGO"] : ["DONOR"]);
  // The note is optional, so an empty or missing body is fine.
  const body = await req.json().catch(() => ({}));
  const parsed = claimNoteSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason ?? null : null;
  if (action === "confirm") return json(await confirmClaim(user, id));
  if (action === "decline") return json(await declineClaim(user, id, reason));
  return json(await withdrawClaim(user, id, reason));
});
