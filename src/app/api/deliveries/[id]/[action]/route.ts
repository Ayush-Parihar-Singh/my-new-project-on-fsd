import { apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { completeDeliverySchema, failDeliverySchema } from "@/validation/operations";
import { acceptDelivery, completeDelivery, markPickedUp, releaseAssignment, reportFailure } from "@/server/services/delivery.service";
import { BadRequestError } from "@/lib/errors";

export const POST = apiRoute<{ id: string; action: string }>(async (req, { params }) => {
  const { id, action } = await params;
  const user = await requireUser(["VOLUNTEER"]);
  switch (action) {
    case "accept":
      return json(await acceptDelivery(user, id));
    case "pick-up":
      return json(await markPickedUp(user, id));
    case "complete": {
      const input = await readJson(req, completeDeliverySchema);
      return json(await completeDelivery(user, id, input.handoverCode));
    }
    case "fail": {
      const input = await readJson(req, failDeliverySchema);
      return json(await reportFailure(user, id, input.reason));
    }
    case "release":
      return json(await releaseAssignment(user, id));
    default:
      throw new BadRequestError("Unknown delivery action.");
  }
});
