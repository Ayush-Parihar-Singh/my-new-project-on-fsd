import { NextResponse } from "next/server";
import { apiRoute, errorResponse } from "@/lib/http";
import { getCurrentUser, requireUser } from "@/server/auth/guards";
import { deleteDonationPhoto, getPhotoForViewer } from "@/server/services/photo.service";

/** Private photo delivery. Access is checked against the donation's visibility rules on every request. */
export const GET = async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const { bytes, mimeType } = await getPhotoForViewer(await getCurrentUser(), id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser(["DONOR"]);
  const { id } = await params;
  await deleteDonationPhoto(user, id);
  return NextResponse.json({ ok: true });
});
