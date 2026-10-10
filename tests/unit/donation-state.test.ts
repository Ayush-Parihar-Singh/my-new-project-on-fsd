import { describe, expect, it } from "vitest";
import { DONATION_TRANSITIONS, assertCanTransition, canTransition, isTerminal, InvalidTransitionError } from "@/domain/donation-state";
import { canDeliveryTransition } from "@/domain/delivery-state";
import type { DonationStatus } from "@/generated/prisma/enums";

const ALL = Object.keys(DONATION_TRANSITIONS) as DonationStatus[];

describe("donation lifecycle", () => {
  it("allows the primary happy path in order", () => {
    const path: DonationStatus[] = ["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("rejects skipping steps", () => {
    expect(canTransition("DRAFT", "REQUESTED")).toBe(false);
    expect(canTransition("AVAILABLE", "COMPLETED")).toBe(false);
    expect(canTransition("REQUESTED", "COMPLETED")).toBe(false);
    expect(() => assertCanTransition("AVAILABLE", "PICKUP_IN_PROGRESS")).toThrow(InvalidTransitionError);
  });

  it("treats COMPLETED, CANCELLED, EXPIRED, REJECTED and FAILED_HANDOVER as terminal", () => {
    for (const s of ["COMPLETED", "CANCELLED", "EXPIRED", "REJECTED", "FAILED_HANDOVER"] as const) {
      expect(isTerminal(s)).toBe(true);
      for (const to of ALL) expect(canTransition(s, to)).toBe(false);
    }
  });

  it("only allows cancellation before a volunteer starts pickup", () => {
    expect(canTransition("AVAILABLE", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PICKUP_IN_PROGRESS", "CANCELLED")).toBe(false);
  });

  it("releases an assignment back to CONFIRMED and fails overdue handovers", () => {
    expect(canTransition("PICKUP_IN_PROGRESS", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "FAILED_HANDOVER")).toBe(true);
    expect(canTransition("PICKUP_IN_PROGRESS", "FAILED_HANDOVER")).toBe(true);
  });

  it("lets an unclaimed request return to AVAILABLE, but never a completed one", () => {
    expect(canTransition("REQUESTED", "AVAILABLE")).toBe(true);
    expect(canTransition("CONFIRMED", "AVAILABLE")).toBe(true);
    expect(canTransition("COMPLETED", "AVAILABLE")).toBe(false);
  });
});

describe("delivery lifecycle", () => {
  it("follows OPEN -> ASSIGNED -> PICKED_UP -> DELIVERED", () => {
    expect(canDeliveryTransition("OPEN", "ASSIGNED")).toBe(true);
    expect(canDeliveryTransition("ASSIGNED", "PICKED_UP")).toBe(true);
    expect(canDeliveryTransition("PICKED_UP", "DELIVERED")).toBe(true);
    expect(canDeliveryTransition("OPEN", "DELIVERED")).toBe(false);
    expect(canDeliveryTransition("DELIVERED", "OPEN")).toBe(false);
  });

  it("lets an assigned volunteer release a task before pickup", () => {
    expect(canDeliveryTransition("ASSIGNED", "OPEN")).toBe(true);
    expect(canDeliveryTransition("PICKED_UP", "OPEN")).toBe(false);
  });
});
