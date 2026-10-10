// Volunteer delivery workflow: accept -> picked up -> delivered (with handover code) or failed.
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashHandoverCode, safeEqual } from "@/lib/crypto";
import { haversineKm } from "@/domain/geo";
import { toDonationView, type DonationView } from "@/domain/visibility";
import type { AuthUser } from "../auth/session";
import { requireVerified } from "../auth/guards";
import * as deliveries from "../repositories/deliveries.repo";
import * as donationsRepo from "../repositories/donations.repo";
import * as users from "../repositories/users.repo";
import { notifyUsers, dispatchEmails } from "./notification.service";
import { writeAudit } from "../repositories/notifications.repo";
import { getDonationForViewer } from "./donation.service";
import { viewerOf } from "./viewer";

async function requireVolunteerProfile(actor: AuthUser) {
  if (actor.role !== "VOLUNTEER") throw new ForbiddenError("Only volunteers can take delivery tasks.");
  const full = await users.findUserById(actor.id);
  if (!full?.volunteerProfile) {
    throw new RuleViolationError("Complete your volunteer profile before taking tasks.", { code: "PROFILE_INCOMPLETE" });
  }
  return full.volunteerProfile;
}

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

/** Board for the volunteer: open tasks near them, their active work and history. */
export async function volunteerBoard(actor: AuthUser) {
  const now = new Date();
  const profile = await users.findUserById(actor.id);
  const vp = profile?.volunteerProfile ?? null;
  const viewer = viewerOf(actor);
  const open = await deliveries.findOpenDeliveries(now);
  const nearby = vp
    ? open.filter((d) => d.donation.pickupLatitude != null && d.donation.pickupLongitude != null &&
        haversineKm(vp, { latitude: d.donation.pickupLatitude, longitude: d.donation.pickupLongitude }) <= vp.serviceRadiusKm + 0.01)
    : [];
  const active = await deliveries.findVolunteerDeliveries(actor.id, ["ASSIGNED", "PICKED_UP"]);
  const history = await deliveries.findVolunteerDeliveries(actor.id, ["DELIVERED", "FAILED"], 30);
  const toTask = (d: (typeof open)[number]) => ({
    deliveryId: d.id,
    deliveryStatus: d.status,
    distanceKm: vp && d.donation.pickupLatitude != null && d.donation.pickupLongitude != null
      ? Math.round(haversineKm(vp, { latitude: d.donation.pickupLatitude, longitude: d.donation.pickupLongitude }) * 10) / 10
      : null,
    donation: toDonationView(d.donation, viewer) as DonationView,
  });
  return {
    verified: actor.verificationStatus === "VERIFIED",
    isAvailable: vp?.isAvailable ?? false,
    profileComplete: !!vp,
    available: nearby.map(toTask),
    active: active.map(toTask),
    history: history.map(toTask),
    stats: {
      completed: history.filter((h) => h.status === "DELIVERED").length,
      failed: history.filter((h) => h.status === "FAILED").length,
      active: active.length,
    },
  };
}

export async function acceptDelivery(actor: AuthUser, deliveryId: string) {
  const vp = await requireVolunteerProfile(actor);
  requireVerified(actor);
  if (!vp.isAvailable) throw new ConflictError("You are marked unavailable. Switch to available in your profile to accept tasks.", "UNAVAILABLE");
  const now = new Date();

  const existing = await deliveries.requireDelivery(deliveryId);
  if (existing.status !== "OPEN") {
    throw new ConflictError("Another volunteer has already accepted this task.", "ALREADY_ASSIGNED");
  }
  const d = existing.donation;
  if (d.status !== "CONFIRMED" || !d.pickupDeadline || d.pickupDeadline <= now) {
    throw new ConflictError("This pickup is no longer available.", "NOT_ASSIGNABLE");
  }
  if (d.pickupLatitude == null || d.pickupLongitude == null) throw new ConflictError("This task is missing its pickup location.", "NOT_ASSIGNABLE");
  if (haversineKm(vp, { latitude: d.pickupLatitude, longitude: d.pickupLongitude }) > vp.serviceRadiusKm + 0.01) {
    throw new RuleViolationError(`This pickup is outside your ${vp.serviceRadiusKm} km service radius.`, { code: "OUT_OF_RADIUS" });
  }

  const pending = await db.$transaction(async (tx) => {
    // Lock the donation first (lock order: donation -> delivery) to avoid deadlocks.
    await donationsRepo.lockDonation(tx, d.id);
    const claim = await tx.delivery.updateMany({
      where: { id: deliveryId, status: "OPEN" },
      data: { status: "ASSIGNED", volunteerId: actor.id, assignedAt: now, version: { increment: 1 } },
    });
    if (claim.count !== 1) throw new ConflictError("Another volunteer has just accepted this task.", "ALREADY_ASSIGNED");
    await donationsRepo.transitionDonation(tx, d.id, "PICKUP_IN_PROGRESS", {
      action: "ASSIGNMENT_ACCEPTED",
      actorId: actor.id,
      actorRole: "VOLUNTEER",
      expectedFrom: ["CONFIRMED"],
      data: { pickupStartedAt: now },
    });
    return notifyUsers(tx, [
      {
        userId: d.donorId,
        type: "ASSIGNMENT_ACCEPTED",
        title: "A volunteer is collecting your donation",
        body: `${firstName(actor.fullName)} accepted the pickup of "${d.title}".`,
        link: `/donations/${d.id}`,
      },
      ...(d.claimedById
        ? [{
            userId: d.claimedById,
            type: "PICKUP_STARTED" as const,
            title: "Your food is on the way",
            body: `A volunteer accepted the delivery of "${d.title}". Keep your handover code ready.`,
            link: `/donations/${d.id}`,
          }]
        : []),
    ]);
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, d.id) };
}

async function requireMyDelivery(actor: AuthUser, deliveryId: string) {
  const delivery = await deliveries.requireDelivery(deliveryId);
  if (delivery.volunteerId !== actor.id) throw new NotFoundError("That delivery task is not assigned to you.");
  return delivery;
}

export async function markPickedUp(actor: AuthUser, deliveryId: string) {
  await requireVolunteerProfile(actor);
  const delivery = await requireMyDelivery(actor, deliveryId);
  if (delivery.status !== "ASSIGNED") throw new ConflictError("This task is not waiting for pickup.", "INVALID_TRANSITION");
  await db.$transaction(async (tx) => {
    await deliveries.transitionDelivery(tx, delivery, "PICKED_UP", { pickedUpAt: new Date() });
    await donationsRepo.appendEvent(tx, {
      donationId: delivery.donationId,
      action: "PICKED_UP",
      fromStatus: "PICKUP_IN_PROGRESS",
      toStatus: "PICKUP_IN_PROGRESS",
      actorId: actor.id,
      actorRole: "VOLUNTEER",
      note: "Food collected from the donor.",
    });
  });
  return { donation: await getDonationForViewer(actor, delivery.donationId) };
}

export async function completeDelivery(actor: AuthUser, deliveryId: string, code: string) {
  await requireVolunteerProfile(actor);
  consumeRateLimit(`handover:${actor.id}:${deliveryId}`, 6, 10 * 60_000);
  const delivery = await requireMyDelivery(actor, deliveryId);
  if (!["ASSIGNED", "PICKED_UP"].includes(delivery.status)) {
    throw new ConflictError("This task is not in progress.", "INVALID_TRANSITION");
  }
  const d = delivery.donation;
  if (!d.handoverCodeHash || d.status !== "PICKUP_IN_PROGRESS") {
    throw new ConflictError("This handover cannot be completed right now.", "INVALID_TRANSITION");
  }
  if (!safeEqual(hashHandoverCode(d.id, code), d.handoverCodeHash)) {
    throw new RuleViolationError("That handover code does not match. Ask the recipient to read it again.", { code: "INVALID_HANDOVER_CODE" });
  }

  const now = new Date();
  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.lockDonation(tx, d.id);
    let current = delivery;
    if (current.status === "ASSIGNED") {
      await deliveries.transitionDelivery(tx, current, "PICKED_UP", { pickedUpAt: now });
      current = { ...current, status: "PICKED_UP", version: current.version + 1 };
    }
    await deliveries.transitionDelivery(tx, current, "DELIVERED", { deliveredAt: now });
    await donationsRepo.transitionDonation(tx, d.id, "COMPLETED", {
      action: "HANDOVER_COMPLETED",
      actorId: actor.id,
      actorRole: "VOLUNTEER",
      note: "Recipient confirmed with handover code.",
      expectedFrom: ["PICKUP_IN_PROGRESS"],
      data: { completedAt: now },
    });
    await writeAudit(tx, { actorId: actor.id, action: "handover.completed", entityType: "Donation", entityId: d.id, metadata: { deliveryId } });
    const people = [d.donorId, d.claimedById, actor.id].filter((x): x is string => !!x);
    return notifyUsers(
      tx,
      people.map((userId) => ({
        userId,
        type: "HANDOVER_COMPLETED" as const,
        title: "Handover completed",
        body: `"${d.title}" was delivered and confirmed with the handover code.`,
        link: userId === actor.id ? "/deliveries" : `/donations/${d.id}`,
      })),
    );
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, d.id) };
}

export async function reportFailure(actor: AuthUser, deliveryId: string, reason: string) {
  await requireVolunteerProfile(actor);
  const delivery = await requireMyDelivery(actor, deliveryId);
  if (!["ASSIGNED", "PICKED_UP"].includes(delivery.status)) throw new ConflictError("This task cannot be marked as failed now.", "INVALID_TRANSITION");
  const d = delivery.donation;
  const now = new Date();
  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.lockDonation(tx, d.id);
    await deliveries.transitionDelivery(tx, delivery, "FAILED", { failedAt: now, failureReason: reason });
    await donationsRepo.transitionDonation(tx, d.id, "FAILED_HANDOVER", {
      action: "HANDOVER_FAILED",
      actorId: actor.id,
      actorRole: "VOLUNTEER",
      note: reason,
      expectedFrom: ["PICKUP_IN_PROGRESS"],
      data: { failedAt: now, failureReason: reason },
    });
    const people = [d.donorId, d.claimedById].filter((x): x is string => !!x);
    return notifyUsers(
      tx,
      people.map((userId) => ({
        userId,
        type: "HANDOVER_FAILED" as const,
        title: "Handover could not be completed",
        body: `The delivery of "${d.title}" failed: ${reason}`,
        link: `/donations/${d.id}`,
      })),
    );
  });
  await dispatchEmails(pending);
  return { donation: await getDonationForViewer(actor, d.id) };
}

export async function releaseAssignment(actor: AuthUser, deliveryId: string) {
  await requireVolunteerProfile(actor);
  const delivery = await requireMyDelivery(actor, deliveryId);
  if (delivery.status !== "ASSIGNED") {
    throw new ConflictError("Only tasks you have not yet collected can be released.", "INVALID_TRANSITION");
  }
  const d = delivery.donation;
  const pending = await db.$transaction(async (tx) => {
    await donationsRepo.lockDonation(tx, d.id);
    await deliveries.transitionDelivery(tx, delivery, "OPEN", { volunteerId: null, assignedAt: null });
    await donationsRepo.transitionDonation(tx, d.id, "CONFIRMED", {
      action: "ASSIGNMENT_RELEASED",
      actorId: actor.id,
      actorRole: "VOLUNTEER",
      expectedFrom: ["PICKUP_IN_PROGRESS"],
      data: { pickupStartedAt: null },
    });
    return notifyUsers(tx, [
      {
        userId: d.donorId,
        type: "ASSIGNMENT_RELEASED",
        title: "Pickup needs another volunteer",
        body: `A volunteer released the pickup of "${d.title}". It is open for another volunteer.`,
        link: `/donations/${d.id}`,
      },
    ]);
  });
  await dispatchEmails(pending);
  // The volunteer is no longer a participant once released, so only the task id is returned.
  return { released: true as const, deliveryId };
}
