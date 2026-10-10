// Secure donation photo handling: size limit, magic-byte type detection (never trust the
// client's filename or MIME type), random storage keys, and authorized-only retrieval.
import { randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { accessLevel } from "@/domain/visibility";
import { DONATION_LIMITS } from "@/validation/donation";
import type { AuthUser } from "../auth/session";
import { privateStorage } from "../integrations/storage";
import * as donationsRepo from "../repositories/donations.repo";

type DetectedType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

export function detectImageType(buf: Buffer): DetectedType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export async function uploadDonationPhoto(actor: AuthUser, donationId: string, file: File) {
  if (actor.role !== "DONOR") throw new ForbiddenError("Only donors can add photos to a donation.");
  consumeRateLimit(`upload:${actor.id}`, 40, 60 * 60_000);
  const d = await donationsRepo.requireDonation(donationId);
  if (d.donorId !== actor.id) throw new NotFoundError();
  if (!["DRAFT", "AVAILABLE"].includes(d.status) || d.claimedById) {
    throw new ConflictError("Photos can only be changed before a recipient claims the donation.", "NOT_EDITABLE");
  }
  if (d.photos.length >= DONATION_LIMITS.maxPhotos) {
    throw new RuleViolationError(`You can attach up to ${DONATION_LIMITS.maxPhotos} photos per donation.`, { code: "PHOTO_LIMIT" });
  }
  if (file.size === 0) throw new BadRequestError("The selected file is empty.");
  if (file.size > env.maxUploadBytes) {
    throw new BadRequestError(`Photos must be ${env.MAX_UPLOAD_MB} MB or smaller.`, { code: "FILE_TOO_LARGE" });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) throw new BadRequestError("Only JPEG, PNG or WebP images are allowed.", { code: "UNSUPPORTED_TYPE" });

  const key = `${randomToken(18)}.${detected.ext}`;
  await privateStorage.put(key, buffer);
  try {
    const photo = await db.donationPhoto.create({
      data: { donationId, storageKey: key, mimeType: detected.mime, sizeBytes: buffer.length, uploadedById: actor.id },
    });
    return { id: photo.id, url: `/api/files/photos/${photo.id}` };
  } catch (error) {
    await privateStorage.remove(key);
    throw error;
  }
}

export async function getPhotoForViewer(actor: AuthUser | null, photoId: string) {
  const photo = await db.donationPhoto.findUnique({ where: { id: photoId }, include: { donation: { include: donationsRepo.donationInclude } } });
  if (!photo) throw new NotFoundError();
  const d = photo.donation;
  const level = accessLevel(actor ? { id: actor.id, role: actor.role, verificationStatus: actor.verificationStatus } : null, {
    donorId: d.donorId,
    claimedById: d.claimedById,
    status: d.status,
    delivery: d.delivery ? { volunteerId: d.delivery.volunteerId, status: d.delivery.status } : null,
  });
  if (level === "PUBLIC") throw new NotFoundError();
  const bytes = await privateStorage.get(photo.storageKey);
  return { bytes, mimeType: photo.mimeType };
}

export async function deleteDonationPhoto(actor: AuthUser, photoId: string) {
  const photo = await db.donationPhoto.findUnique({ where: { id: photoId }, include: { donation: true } });
  if (!photo || photo.donation.donorId !== actor.id) throw new NotFoundError();
  if (!["DRAFT", "AVAILABLE"].includes(photo.donation.status) || photo.donation.claimedById) {
    throw new ConflictError("Photos are locked once a recipient claims the donation.", "NOT_EDITABLE");
  }
  await db.donationPhoto.delete({ where: { id: photoId } });
  await privateStorage.remove(photo.storageKey);
}
