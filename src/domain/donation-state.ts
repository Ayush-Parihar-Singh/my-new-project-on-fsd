// The donation lifecycle as a pure state machine. Every status change in the
// application must pass through `assertCanTransition` (enforced in the repository layer).
import type { DonationStatus } from "@/generated/prisma/enums";

export const DONATION_TRANSITIONS: Record<DonationStatus, readonly DonationStatus[]> = {
  DRAFT: ["AVAILABLE", "CANCELLED"],
  AVAILABLE: ["REQUESTED", "CANCELLED", "EXPIRED", "REJECTED"],
  REQUESTED: ["CONFIRMED", "AVAILABLE", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["PICKUP_IN_PROGRESS", "AVAILABLE", "CANCELLED", "FAILED_HANDOVER"],
  PICKUP_IN_PROGRESS: ["COMPLETED", "CONFIRMED", "FAILED_HANDOVER"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED_HANDOVER: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: DonationStatus,
    public readonly to: DonationStatus,
  ) {
    super(`A donation cannot move from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: DonationStatus, to: DonationStatus): boolean {
  return DONATION_TRANSITIONS[from].includes(to);
}

export function assertCanTransition(from: DonationStatus, to: DonationStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: DonationStatus): boolean {
  return DONATION_TRANSITIONS[status].length === 0;
}

/** Statuses in which the donor may still edit listing details (no active claim). */
export const EDITABLE_STATUSES: readonly DonationStatus[] = ["DRAFT", "AVAILABLE"];
/** Statuses an NGO may claim. */
export const CLAIMABLE_STATUSES: readonly DonationStatus[] = ["AVAILABLE"];
