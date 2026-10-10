// Delivery (volunteer assignment) lifecycle. Donation status changes are driven from
// these transitions in the delivery service so both records always agree.
import type { DeliveryStatus } from "@/generated/prisma/enums";

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "OPEN", "FAILED", "CANCELLED"],
  PICKED_UP: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}
