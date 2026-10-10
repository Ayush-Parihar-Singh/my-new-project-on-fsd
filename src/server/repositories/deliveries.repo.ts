// Delivery (volunteer assignment) persistence.
import type { Prisma } from "@/generated/prisma/client";
import type { DeliveryStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db";
import { canDeliveryTransition } from "@/domain/delivery-state";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { donationInclude } from "./donations.repo";

export const deliveryInclude = {
  donation: { include: donationInclude },
} satisfies Prisma.DeliveryInclude;

export type DeliveryWithDonation = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

export async function requireDelivery(id: string, client: Tx | typeof db = db): Promise<DeliveryWithDonation> {
  const d = await client.delivery.findUnique({ where: { id }, include: deliveryInclude });
  if (!d) throw new NotFoundError("That delivery task does not exist.");
  return d;
}

/** Transition a delivery; enforces the delivery state machine and optimistic version. */
export async function transitionDelivery(
  tx: Tx,
  delivery: { id: string; status: DeliveryStatus; version: number },
  to: DeliveryStatus,
  data: Prisma.DeliveryUncheckedUpdateManyInput = {},
): Promise<void> {
  if (!canDeliveryTransition(delivery.status, to)) {
    throw new ConflictError(`Delivery cannot move from ${delivery.status} to ${to}.`, "INVALID_TRANSITION");
  }
  const result = await tx.delivery.updateMany({
    where: { id: delivery.id, version: delivery.version },
    data: { ...data, status: to, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ConflictError("This delivery was updated moments ago. Please refresh.", "STALE_STATE");
}

export const findOpenDeliveries = (now: Date) =>
  db.delivery.findMany({
    where: { status: "OPEN", donation: { status: "CONFIRMED", pickupDeadline: { gt: now } } },
    include: deliveryInclude,
    orderBy: { createdAt: "asc" },
    take: 200,
  });

export const findVolunteerDeliveries = (volunteerId: string, statuses: DeliveryStatus[], take = 50) =>
  db.delivery.findMany({
    where: { volunteerId, status: { in: statuses } },
    include: deliveryInclude,
    orderBy: { updatedAt: "desc" },
    take,
  });

export const countVolunteerDeliveries = (volunteerId: string) =>
  db.delivery.groupBy({ by: ["status"], where: { volunteerId }, _count: { _all: true } });

export const upsertDeliveryForDonation = (tx: Tx, donationId: string) =>
  tx.delivery.upsert({
    where: { donationId },
    create: { donationId, status: "OPEN" },
    update: {
      status: "OPEN",
      volunteerId: null,
      assignedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      failedAt: null,
      failureReason: null,
    },
  });
