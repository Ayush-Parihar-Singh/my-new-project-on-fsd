import { describe, expect, it } from "vitest";
import {
  deadlineScore,
  evaluateEligibility,
  quantityScore,
  rankDonations,
  receivingHoursScore,
  scoreDonation,
  MIN_PICKUP_LEAD_MINUTES,
  type MatchDonation,
  type MatchRecipient,
} from "@/domain/matching";

const NOW = new Date("2026-10-10T10:00:00Z");
const base: MatchDonation = {
  id: "d1",
  quantity: 10,
  unit: "PORTIONS",
  latitude: 12.9716,
  longitude: 77.5946,
  pickupDeadline: new Date(NOW.getTime() + 5 * 3600_000),
  availableFrom: new Date(NOW.getTime()),
  availableUntil: new Date(NOW.getTime() + 3 * 3600_000),
  dietaryTags: ["VEGETARIAN"],
  allergens: ["DAIRY"],
};
const recipient: MatchRecipient = {
  latitude: 12.9716,
  longitude: 77.5946,
  serviceRadiusKm: 10,
  receivingStartHour: null,
  receivingEndHour: null,
  dietaryNeeds: [],
  avoidAllergens: [],
  maxPickupQuantity: 20,
};

describe("eligibility (hard filters)", () => {
  it("accepts a nearby, compatible donation", () => {
    expect(evaluateEligibility(base, recipient, NOW).eligible).toBe(true);
  });

  it("rejects donations outside the service radius", () => {
    const far = { ...base, latitude: 13.2, longitude: 77.5946 };
    const r = evaluateEligibility(far, recipient, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/service radius/);
  });

  it("rejects donations whose deadline is too close", () => {
    const soon = { ...base, pickupDeadline: new Date(NOW.getTime() + (MIN_PICKUP_LEAD_MINUTES - 5) * 60_000) };
    expect(evaluateEligibility(soon, recipient, NOW).reasons.join(" ")).toMatch(/deadline/);
  });

  it("enforces required dietary tags", () => {
    const r = evaluateEligibility(base, { ...recipient, dietaryNeeds: ["VEGAN"] }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/VEGAN/);
  });

  it("blocks allergens the recipient avoids", () => {
    const r = evaluateEligibility(base, { ...recipient, avoidAllergens: ["DAIRY"] }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/DAIRY/);
  });
});

describe("scoring (soft preferences)", () => {
  it("scores urgent deadlines higher", () => {
    expect(deadlineScore(1)).toBeGreaterThan(deadlineScore(10));
    expect(deadlineScore(30)).toBeLessThan(deadlineScore(3));
  });

  it("scores quantity fit by capacity, neutral when unknown", () => {
    expect(quantityScore(10, "PORTIONS", recipient)).toBe(1);
    expect(quantityScore(35, "PORTIONS", recipient)).toBe(0.5);
    expect(quantityScore(100, "PORTIONS", recipient)).toBe(0.2);
    expect(quantityScore(10, "PORTIONS", { ...recipient, maxPickupQuantity: null })).toBe(0.5);
    expect(quantityScore(10, "KG", { ...recipient, preferredUnit: "PORTIONS" })).toBe(0.5);
  });

  it("checks receiving hours against the availability window", () => {
    const d = {
      availableFrom: new Date(2026, 9, 10, 9, 0, 0),
      availableUntil: new Date(2026, 9, 10, 11, 0, 0),
    };
    expect(receivingHoursScore(d, { receivingStartHour: 10, receivingEndHour: 12 })).toBe(1);
    expect(receivingHoursScore(d, { receivingStartHour: 18, receivingEndHour: 22 })).toBe(0);
    expect(receivingHoursScore(d, { receivingStartHour: null, receivingEndHour: null })).toBe(0.5);
  });

  it("returns a total in 0-100 with a breakdown that sums to the score", () => {
    const s = scoreDonation(base, recipient, [], NOW);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    const sum = Object.values(s.breakdown).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - s.score)).toBeLessThanOrEqual(3);
  });

  it("gives volunteer coverage credit only for available volunteers in range", () => {
    const covered = scoreDonation(base, recipient, [{ latitude: 12.9716, longitude: 77.5946, serviceRadiusKm: 5, isAvailable: true }], NOW);
    const unavailable = scoreDonation(base, recipient, [{ latitude: 12.9716, longitude: 77.5946, serviceRadiusKm: 5, isAvailable: false }], NOW);
    expect(covered.breakdown.volunteerCoverage).toBeGreaterThan(unavailable.breakdown.volunteerCoverage);
  });
});

describe("ranking", () => {
  it("puts eligible matches first and then by score", () => {
    const ineligible = { ...base, id: "bad", dietaryTags: [] };
    const better = { ...base, id: "good", pickupDeadline: new Date(NOW.getTime() + 2 * 3600_000) };
    const ranked = rankDonations([ineligible, base, better], { ...recipient, dietaryNeeds: ["VEGETARIAN"] }, [], NOW);
    expect(ranked.map((r) => r.donationId)).toEqual(["good", "d1", "bad"]);
    expect(ranked[2]!.eligible).toBe(false);
  });
});
