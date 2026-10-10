// Recipient claiming. A claim is a compare-and-set transition inside a row-locked transaction,
// so two recipients racing for the same donation can never both succeed.
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from "@/lib/errors";
import { evaluateEligibility, type MatchRecipient } from "@/domain/matching";
import { toMatchDonation, toMatchRecipient } from "./matching-adapters";
import { generateHandoverCode, hashHandoverCode, encryptSecret } from "@/lib/crypto";
import { toDonationView } from "@/domain/visibility";
import type { AuthUser } from "../auth/session";
import { requireVerified } from "../auth/guards";
import * as donationsRepo from "../repositories/donations.repo";
import * as deliveries from "../repositories/deliveries.repo";
import * as users from "../repositories/users.repo";
import { notifyUsers, dispatchEmails } from "./notification.service";
import { getDonationForViewer } from "./donation.service";
import { haversineKm } from "@/domain/geo";

async function recipientProfile(user: AuthUser): Promise<MatchRecipient> {
  const full = await users.findUserById(user.id);
  if (!full?.organization) {
    throw new RuleViolationError("Complete your organization profile before claiming food.", { code: "PROFILE_INCOMPLETE" });
  }
  return toMatchRecipient(full.organization);
}

export async function claimDonation(actor: AuthUser, id: string): Promise<{ donation: Awaited<ReturnType<typeof getDonationForViewer>> }> {
  if (actor.role !== "NGO") throw new ForbiddenError("Only recipient organizations can claim donations.");
  requireVerified(actor);
  const recipient = await recipientProfile(actor);
  const now = new Date();

  const d = await donationsRepo.findDonation(id);
  if (!d) throw new NotFoundError("That donation is no longer available.");
  if (d.status !== "AVAILABLE") {
    throw new ConflictError(
      d.claimedById ? "Another recipient has already claimed this donation." : "This donation is not open for claims.",
      d.claimedById ? "ALREADY_CLAIMED" : "NOT_CLAIMABLE",
    );
  }
  if (!d.pickupLatitude || !d.pickupLongitude || !d.pickupDeadline || !d.quantity || !d.unit || !d.availableFrom || !d.availableUntil) {
    throw new ConflictError("This listing is incomplete and cannot be claimed.", "NOT_CLAIMABLE");
  }
  const eligibility = evaluateEligibility(toMatchDonation(d), recipient, now);
  if (!eligibility.eligible) {
    throw new RuleViolationError("This donation does not match your organization's requirements.", { reasons: eligibility.reasons });
  }

  const pending = await db.$transaction(async (tx) => {
    const locked = await donationsRepo.lockDonation(tx, id);
    if (locked.status !== "AVAILABLE") {
      throw new ConflictError("Another recipient has just claimed this donation.", "ALREADY_CLAIMED");
    }
    // Compare-and-set: succeeds for exactly one writer even if two requests interleave.
    const res = await tx.donation.updateMany({
      where: { id, status: "AVAILABLE", claimedById: null },
      data: { status: "REQUESTED", claimedById: actor.id, claimedAt: now, version: { increment: 1 } },
    });
    if (res.count !== 1) throw new ConflictError("Another recipient has just claimed this donation.", "ALREADY_CLAIMED");
    await donationsRepo.appendEvent(tx, {
      donationId: id,
      action: "CLAIM_REQUESTED",
      fromStatus: "AVAILABLE",
      toStatus: "REQUESTED",
      actorId: actor.id,
      actorRole: "NGO",
      note: "Recipient requested this donation.",
    });
    return notifyUsers(tx, [
      {
        userId: d.donorId,
        type: "CLAIM_RECEIVED",
        title: "A recipient wants your donation",
        body: `An organization requested "${d.title}". Confirm the claim to arrange pickup.`,
        link: `/donations/${id}`,
      },
    ]);
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, id) };
}

async function requireOwnedDonation(actor: AuthUser, id: string) {
  const d = await donationsRepo.requireDonation(id);
  if (d.donorId !== actor.id) throw new NotFoundError();
  return d;
}

export async function withdrawClaim(actor: AuthUser, id: string, reason?: string | null) {
  if (actor.role !== "NGO") throw new ForbiddenError();
  const d = await donationsRepo.requireDonation(id);
  if (d.claimedById !== actor.id) throw new NotFoundError();
  if (d.delivery && ["ASSIGNED", "PICKED_UP"].includes(d.delivery.status)) {
    throw new ConflictError("A volunteer is already on the way. Please contact the donor instead.", "NOT_WITHDRAWABLE");
  }
  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.transitionDonation(tx, id, "AVAILABLE", {
      action: "CLAIM_WITHDRAWN",
      actorId: actor.id,
      actorRole: "NGO",
      note: reason ?? null,
      expectedFrom: ["REQUESTED", "CONFIRMED"],
      data: { claimedById: null, claimedAt: null, confirmedAt: null, handoverCodeHash: null, handoverCodeCipher: null },
    });
    const delivery = await tx.delivery.findUnique({ where: { donationId: id } });
    if (delivery && delivery.status === "OPEN") {
      await tx.delivery.update({ where: { id: delivery.id }, data: { status: "CANCELLED", version: { increment: 1 } } });
    }
    return notifyUsers(tx, [
      {
        userId: d.donorId,
        type: "CLAIM_WITHDRAWN",
        title: "A claim was withdrawn",
        body: `The recipient withdrew from "${d.title}". It is available for other recipients again.`,
        link: `/donations/${id}`,
      },
    ]);
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, id) };
}

export async function confirmClaim(actor: AuthUser, id: string) {
  if (actor.role !== "DONOR") throw new ForbiddenError("Only the donor can confirm a claim.");
  const d = await requireOwnedDonation(actor, id);
  if (d.status !== "REQUESTED" || !d.claimedById) {
    throw new ConflictError("There is no pending claim to confirm.", "NO_PENDING_CLAIM");
  }
  const now = new Date();
  if (!d.pickupDeadline || d.pickupDeadline <= now) {
    throw new ConflictError("The pickup deadline has passed, so this claim cannot be confirmed.", "DEADLINE_PASSED");
  }
  const code = generateHandoverCode();
  const volunteers = await users.findVerifiedVolunteers();
  const nearby = d.pickupLatitude != null && d.pickupLongitude != null
    ? volunteers
        .filter((v) => haversineKm(v, { latitude: d.pickupLatitude!, longitude: d.pickupLongitude! }) <= v.serviceRadiusKm)
        .slice(0, 25)
    : [];

  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.transitionDonation(tx, id, "CONFIRMED", {
      action: "CLAIM_CONFIRMED",
      actorId: actor.id,
      actorRole: "DONOR",
      expectedFrom: ["REQUESTED"],
      data: {
        confirmedAt: now,
        handoverCodeHash: hashHandoverCode(id, code),
        handoverCodeCipher: encryptSecret(code),
      },
    });
    await deliveries.upsertDeliveryForDonation(tx, id);
    const notes = await notifyUsers(tx, [
      {
        userId: d.claimedById!,
        type: "CLAIM_CONFIRMED",
        title: "Claim confirmed - arrange pickup",
        body: `The donor confirmed "${d.title}". Your 4-digit handover code is shown on the donation page. Share it only when the food is delivered.`,
        link: `/donations/${id}`,
      },
      ...nearby.map((v) => ({
        userId: v.userId,
        type: "DELIVERY_AVAILABLE" as const,
        title: "New delivery task nearby",
        body: `"${d.title}" needs a volunteer to move it before ${d.pickupDeadline!.toLocaleString("en-GB")}.`,
        link: "/deliveries",
      })),
    ]);
    return notes;
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, id) };
}

export async function declineClaim(actor: AuthUser, id: string, reason?: string | null) {
  if (actor.role !== "DONOR") throw new ForbiddenError("Only the donor can decline a claim.");
  const d = await requireOwnedDonation(actor, id);
  if (d.status !== "REQUESTED" || !d.claimedById) {
    throw new ConflictError("There is no pending claim to decline.", "NO_PENDING_CLAIM");
  }
  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.transitionDonation(tx, id, "AVAILABLE", {
      action: "CLAIM_DECLINED",
      actorId: actor.id,
      actorRole: "DONOR",
      note: reason ?? null,
      expectedFrom: ["REQUESTED"],
      data: { claimedById: null, claimedAt: null },
    });
    return notifyUsers(tx, [
      {
        userId: d.claimedById!,
        type: "CLAIM_DECLINED",
        title: "Claim not confirmed",
        body: `The donor could not confirm "${d.title}". It is available again.`,
        link: "/discover",
      },
    ]);
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, id) };
}

export async function listRecipientClaims(actor: AuthUser) {
  const rows = await db.donation.findMany({
    where: { claimedById: actor.id, status: { in: ["REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "FAILED_HANDOVER", "CANCELLED"] } },
    include: donationsRepo.donationInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map((d) => toDonationView(d, { id: actor.id, role: actor.role, verificationStatus: actor.verificationStatus }));
}

