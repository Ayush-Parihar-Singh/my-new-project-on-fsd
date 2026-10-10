import { apiRoute, json } from "@/lib/http";
import { requireUser } from "@/server/auth/guards";
import { uploadDonationPhoto } from "@/server/services/photo.service";
import { BadRequestError } from "@/lib/errors";

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(["DONOR"]);
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new BadRequestError("Choose a photo to upload.");
  return json({ photo: await uploadDonationPhoto(user, id, file) }, 201);
});
