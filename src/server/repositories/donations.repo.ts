// Donation persistence. The ONLY place (with the other repositories) that talks to Prisma.
import type { Prisma } from "@/generated/prisma/client";
import type { DonationStatus, FoodCategory } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db";
import { assertCanTransition } from "@/domain/donation-state";
import { ConflictError, NotFoundError } from "@/lib/errors";

export const donationInclude = {
  photos: { select: { id: true, mimeType: true }, orderBy: { createdAt: "asc" } },
  delivery: {
    include: {
      volunteer: { select: { fullName: true, volunteerProfile: { select: { vehicleType: true } } } },
    },
  },
  donor: {
    select: {
      fullName: true,
      phone: true,
      verificationStatus: true,
      organization: { select: { name: true, type: true, phone: true, addressLine: true, city: true } },
    },
  },
  claimant: {
    select: {
      fullName: true,
      phone: true,
      organization: {
        select: { name: true, type: true, phone: true, addressLine: true, city: true, receivingStartHour: true, receivingEndHour: true },
      },
    },
  },
} satisfies Prisma.DonationInclude;

export type DonationWithRelations = Prisma.DonationGetPayload<{ include: typeof donationInclude }>;

export async function findDonation(id: string, client: Tx | typeof db = db): Promise<DonationWithRelations | null> {
  return client.donation.findUnique({ where: { id }, include: donationInclude });
}

export async function requireDonation(id: string, client: Tx | typeof db = db): Promise<DonationWithRelations> {
  const d = await findDonation(id, client);
  if (!d) throw new NotFoundError("That donation does not exist or is no longer available.");
  return d;
}

/** Row lock (SELECT ... FOR UPDATE). Serializes concurrent state changes on the same donation. */
export async function lockDonation(tx: Tx, id: string): Promise<{ status: DonationStatus; version: number }> {
  const rows = await tx.$queryRaw<{ status: DonationStatus; version: number }[]>`
    SELECT "status", "version" FROM "Donation" WHERE "id" = ${id} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError("That donation does not exist.");
  return rows[0]!;
}

export interface DonationEventInput {
  donationId: string;
  action: string;
  fromStatus?: DonationStatus | null;
  toStatus?: DonationStatus | null;
  actorId?: string | null;
  actorRole?: "DONOR" | "NGO" | "VOLUNTEER" | "ADMIN" | null;
  note?: string | null;
}

export async function appendEvent(tx: Tx, input: DonationEventInput): Promise<void> {
  await tx.donationEvent.create({
    data: {
      donationId: input.donationId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      note: input.note?.slice(0, 300) ?? null,
    },
  });
}

/**
 * Performs one validated status transition inside an open transaction:
 * 1) locks the row, 2) checks the state machine, 3) compare-and-set update, 4) writes history.
 * Throws ConflictError if another writer changed the status first.
 */
export async function transitionDonation(
  tx: Tx,
  donationId: string,
  to: DonationStatus,
  options: {
    action: string;
    actorId?: string | null;
    actorRole?: DonationEventInput["actorRole"];
    note?: string | null;
    data?: Prisma.DonationUncheckedUpdateManyInput;
    expectedFrom?: DonationStatus[];
  },
): Promise<DonationStatus> {
  const current = await lockDonation(tx, donationId);
  if (options.expectedFrom && !options.expectedFrom.includes(current.status)) {
    throw new ConflictError(`This donation is now ${current.status.toLowerCase().replace(/_/g, " ")}. Please refresh and try again.`, "STALE_STATE");
  }
  try {
    assertCanTransition(current.status, to);
  } catch {
    throw new ConflictError(`This action is not allowed while the donation is ${current.status.toLowerCase().replace(/_/g, " ")}.`, "INVALID_TRANSITION");
  }
  const result = await tx.donation.updateMany({
    where: { id: donationId, status: current.status },
    data: { ...options.data, status: to, version: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw new ConflictError("This donation was changed by someone else a moment ago. Please refresh.", "STALE_STATE");
  }
  await appendEvent(tx, {
    donationId,
    action: options.action,
    fromStatus: current.status,
    toStatus: to,
    actorId: options.actorId,
    actorRole: options.actorRole,
    note: options.note,
  });
  return current.status;
}

export async function findOwnedDonations(donorId: string, status: DonationStatus | undefined, skip: number, take: number) {
  const where: Prisma.DonationWhereInput = { donorId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    db.donation.findMany({ where, include: donationInclude, orderBy: { updatedAt: "desc" }, skip, take }),
    db.donation.count({ where }),
  ]);
  return { items, total };
}

export async function findAvailableForDiscovery(filter: { category?: string; dietary?: string; now: Date }) {
  return db.donation.findMany({
    where: {
      status: "AVAILABLE",
      pickupDeadline: { gt: filter.now },
      ...(filter.category ? { category: filter.category as FoodCategory } : {}),
      ...(filter.dietary ? { dietaryTags: { has: filter.dietary } } : {}),
    },
    include: donationInclude,
    orderBy: { pickupDeadline: "asc" },
    take: 500,
  });
}

export async function findRecentForDuplicateCheck(donorId: string, since: Date, excludeId: string) {
  return db.donation.findMany({
    where: {
      donorId,
      id: { not: excludeId },
      publishedAt: { gte: since },
      status: { in: ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED"] },
    },
    select: {
      id: true,
      donorId: true,
      title: true,
      description: true,
      pickupLatitude: true,
      pickupLongitude: true,
      publishedAt: true,
    },
    take: 100,
  });
}

export async function findEventsForDonor(donorId: string, take: number) {
  return db.donationEvent.findMany({
    where: { donation: { donorId } },
    include: { donation: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
