// Donation listings: drafts, editing, publishing (with duplicate detection) and cancellation.
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { EDITABLE_STATUSES } from "@/domain/donation-state";
import { findDuplicates, type DuplicateSubject } from "@/domain/duplicates";
import { toDonationView, type DonationView, type Viewer } from "@/domain/visibility";
import { publishReadinessErrors, type DonationWriteInput } from "@/validation/donation";
import { paginate, type Paginated } from "@/lib/http";
import type { AuthUser } from "../auth/session";
import { requireVerified } from "../auth/guards";
import * as donationsRepo from "../repositories/donations.repo";
import { notifyUsers, dispatchEmails } from "./notification.service";
import { writeAudit } from "../repositories/notifications.repo";
import type { DonationStatus } from "@/generated/prisma/enums";
import { CANCELLABLE_STATUSES_FOR_DONOR } from "./donation-rules";

const DUPLICATE_WINDOW_MS = 72 * 3600_000;

/** Maps the API payload to Prisma data (ISO strings -> Date). Only provided keys are written. */
export function mapWriteToData(input: DonationWriteInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || key === "expectedVersion") continue;
    if (["preparedAt", "availableFrom", "availableUntil", "pickupDeadline"].includes(key)) {
      data[key] = value ? new Date(value as string) : null;
    } else {
      data[key] = value;
    }
  }
  return data;
}

function viewerOf(user: AuthUser | null): Viewer {
  return user ? { id: user.id, role: user.role, verificationStatus: user.verificationStatus } : null;
}

export async function getDonationForViewer(user: AuthUser | null, id: string): Promise<DonationView> {
  const d = await donationsRepo.requireDonation(id);
  const viewer = viewerOf(user);
  const isOwner = !!user && user.id === d.donorId;
  const isAdmin = user?.role === "ADMIN";
  if (d.status === "DRAFT" && !isOwner && !isAdmin) throw new NotFoundError();
  if (d.status !== "AVAILABLE" && !isOwner && !isAdmin) {
    const participant = !!user && (user.id === d.claimedById || user.id === d.delivery?.volunteerId);
    if (!participant) throw new NotFoundError();
  }
  return toDonationView(d, viewer);
}

export async function createDraft(actor: AuthUser, input: DonationWriteInput): Promise<DonationView> {
  if (actor.role !== "DONOR") throw new ForbiddenError("Only donors can post donations.");
  const id = await db.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        ...(mapWriteToData(input) as object),
        donorId: actor.id,
        status: "DRAFT",
        isDemo: false,
      },
    });
    await donationsRepo.appendEvent(tx, { donationId: created.id, action: "CREATED", toStatus: "DRAFT", actorId: actor.id, actorRole: "DONOR" });
    return created.id;
  });
  return getDonationForViewer(actor, id);
}

export async function updateDonation(actor: AuthUser, id: string, input: DonationWriteInput): Promise<DonationView> {
  const existing = await donationsRepo.requireDonation(id);
  if (existing.donorId !== actor.id) throw new NotFoundError();
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new ConflictError("This listing can no longer be edited because a recipient has engaged with it.", "NOT_EDITABLE");
  }
  if (existing.status === "AVAILABLE" && existing.claimedById) {
    throw new ConflictError("This listing has a pending claim. Edits are locked until it is resolved.", "NOT_EDITABLE");
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    throw new ConflictError("This listing was updated in another tab. Reload to see the latest version.", "VERSION_CONFLICT");
  }
  const data = mapWriteToData(input);

  if (existing.status === "AVAILABLE") {
    // A live listing must remain publishable after the edit.
    const merged = { ...existing, ...data } as unknown as Parameters<typeof publishReadinessErrors>[0];
    const errors = publishReadinessErrors(merged, new Date());
    if (Object.keys(errors).length) throw new ValidationError(errors, "Please complete the highlighted fields.");
  }

  await db.$transaction(async (tx) => {
    const locked = await donationsRepo.lockDonation(tx, id);
    if (!EDITABLE_STATUSES.includes(locked.status)) throw new ConflictError("The listing changed status while you were editing.", "STALE_STATE");
    const res = await tx.donation.updateMany({
      where: { id, version: existing.version },
      data: { ...(data as object), version: { increment: 1 } },
    });
    if (res.count !== 1) throw new ConflictError("This listing was updated elsewhere. Reload to continue.", "VERSION_CONFLICT");
    await donationsRepo.appendEvent(tx, {
      donationId: id,
      action: "EDITED",
      fromStatus: locked.status,
      toStatus: locked.status,
      actorId: actor.id,
      actorRole: "DONOR",
      note: `Fields updated: ${Object.keys(data).join(", ")}`.slice(0, 300),
    });
  });
  return getDonationForViewer(actor, id);
}

export async function publishDonation(actor: AuthUser, id: string, acknowledgeDuplicate: boolean): Promise<{ donation: DonationView; warnings: string[] }> {
  if (actor.role !== "DONOR") throw new ForbiddenError("Only donors can publish donations.");
  requireVerified(actor);
  const d = await donationsRepo.requireDonation(id);
  if (d.donorId !== actor.id) throw new NotFoundError();
  if (d.status !== "DRAFT") throw new ConflictError("Only drafts can be published.", "INVALID_TRANSITION");

  const now = new Date();
  const errors = publishReadinessErrors(d as unknown as Parameters<typeof publishReadinessErrors>[0], now);
  if (Object.keys(errors).length) throw new ValidationError(errors, "Complete the highlighted fields before publishing.");

  // Duplicate detection: similar listings from the same donor in the last 72 hours.
  const recent = await donationsRepo.findRecentForDuplicateCheck(actor.id, new Date(now.getTime() - DUPLICATE_WINDOW_MS), id);
  const subject: DuplicateSubject & { id: string } = {
    id,
    donorId: actor.id,
    title: d.title,
    description: d.description,
    latitude: d.pickupLatitude!,
    longitude: d.pickupLongitude!,
    at: now,
  };
  const others = recent.map((r) => ({
    id: r.id,
    donorId: r.donorId,
    title: r.title,
    description: r.description,
    latitude: r.pickupLatitude ?? 0,
    longitude: r.pickupLongitude ?? 0,
    at: r.publishedAt ?? now,
  }));
  const matches = findDuplicates(subject, others);
  if (matches.length > 0 && !acknowledgeDuplicate) {
    throw new ConflictError(
      "This looks very similar to a listing you posted recently. Review it, or publish anyway if this is a different batch.",
      "DUPLICATE_SUSPECTED",
      { duplicates: matches.map((m) => ({ id: m.id, title: m.title, score: m.score })) },
    );
  }

  await db.$transaction(async (tx) => {
    await donationsRepo.transitionDonation(tx, id, "AVAILABLE", {
      action: "PUBLISHED",
      actorId: actor.id,
      actorRole: "DONOR",
      expectedFrom: ["DRAFT"],
      data: {
        publishedAt: now,
        duplicateFlagged: matches.length > 0,
        duplicateOfId: matches[0]?.id ?? null,
        duplicateScore: matches[0]?.score ?? null,
      },
    });
  });
  const view = await getDonationForViewer(actor, id);
  return {
    donation: view,
    warnings: matches.length > 0 ? ["Flagged for review as a possible duplicate of a recent listing."] : [],
  };
}

export async function cancelDonation(actor: AuthUser, id: string, reason: string): Promise<DonationView> {
  const d = await donationsRepo.requireDonation(id);
  if (d.donorId !== actor.id) throw new NotFoundError();
  if (!CANCELLABLE_STATUSES_FOR_DONOR.includes(d.status as DonationStatus)) {
    throw new ConflictError(
      d.status === "PICKUP_IN_PROGRESS"
        ? "A volunteer is already collecting this food, so it can no longer be cancelled. Contact the LastPlate team if this is urgent."
        : "This donation can no longer be cancelled.",
      "NOT_CANCELLABLE",
    );
  }
  const emails = await db.$transaction(async (tx) => {
    await donationsRepo.transitionDonation(tx, id, "CANCELLED", {
      action: "CANCELLED",
      actorId: actor.id,
      actorRole: "DONOR",
      note: reason,
      data: { cancelledAt: new Date(), cancellationReason: reason },
    });
    const delivery = await tx.delivery.findUnique({ where: { donationId: id } });
    const notifications: Parameters<typeof notifyUsers>[1] = [];
    if (delivery && (delivery.status === "OPEN" || delivery.status === "ASSIGNED")) {
      await tx.delivery.update({ where: { id: delivery.id }, data: { status: "CANCELLED", version: { increment: 1 } } });
      if (delivery.volunteerId) {
        notifications.push({
          userId: delivery.volunteerId,
          type: "DONATION_CANCELLED",
          title: "Delivery task cancelled",
          body: `"${d.title}" was cancelled by the donor. No pickup is needed.`,
          link: "/deliveries",
        });
      }
    }
    if (d.claimedById) {
      notifications.push({
        userId: d.claimedById,
        type: "DONATION_CANCELLED",
        title: "A donation was cancelled",
        body: `"${d.title}" was cancelled by the donor. Reason: ${reason}`,
        link: "/claims",
      });
    }
    return notifyUsers(tx, notifications);
  });
  await dispatchEmails(emails);
  return getDonationForViewer(actor, id);
}

export async function listOwnDonations(
  actor: AuthUser,
  opts: { status?: DonationStatus; page: number; pageSize: number },
): Promise<Paginated<DonationView>> {
  const { items, total } = await donationsRepo.findOwnedDonations(actor.id, opts.status, (opts.page - 1) * opts.pageSize, opts.pageSize);
  return paginate(
    items.map((d) => toDonationView(d, viewerOf(actor))),
    total,
    opts.page,
    opts.pageSize,
  );
}


/** Status history for a donation the viewer is allowed to see. Actors are shown by role, not by name. */
export async function donationHistory(user: AuthUser | null, id: string) {
  await getDonationForViewer(user, id); // Enforces the same visibility rules as the detail view.
  const events = await db.donationEvent.findMany({
    where: { donationId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, fromStatus: true, toStatus: true, actorRole: true, note: true, createdAt: true },
  });
  return events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
}
