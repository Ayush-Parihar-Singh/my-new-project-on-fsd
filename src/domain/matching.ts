// Smart Matching Engine (pure, deterministic, unit-tested).
// Hard filters remove ineligible donations; a weighted score ranks the rest.
// All inputs are plain values so the logic can be tested without a database.
import { haversineKm } from "./geo";

export interface MatchDonation {
  id: string;
  quantity: number;
  unit: string;
  latitude: number;
  longitude: number;
  pickupDeadline: Date;
  availableFrom: Date;
  availableUntil: Date;
  dietaryTags: string[];
  allergens: string[];
}

export interface MatchRecipient {
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  receivingStartHour: number | null;
  receivingEndHour: number | null;
  dietaryNeeds: string[];
  avoidAllergens: string[];
  maxPickupQuantity: number | null;
  /** Unit the recipient usually handles; quantities in other units are scored neutrally. */
  preferredUnit?: string | null;
}

export interface MatchVolunteer {
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  isAvailable: boolean;
}

export const MIN_PICKUP_LEAD_MINUTES = 30;

export const MATCH_WEIGHTS = {
  distance: 30,
  deadline: 20,
  quantity: 15,
  receivingHours: 15,
  volunteerCoverage: 20,
} as const;

export interface EligibilityResult {
  eligible: boolean;
  distanceKm: number;
  reasons: string[];
}

export function evaluateEligibility(
  donation: MatchDonation,
  recipient: MatchRecipient,
  now: Date,
): EligibilityResult {
  const reasons: string[] = [];
  const distanceKm = haversineKm(recipient, donation);

  if (distanceKm > recipient.serviceRadiusKm) {
    reasons.push(`Outside your ${recipient.serviceRadiusKm} km service radius (${distanceKm.toFixed(1)} km away)`);
  }
  const leadMs = donation.pickupDeadline.getTime() - now.getTime();
  if (leadMs < MIN_PICKUP_LEAD_MINUTES * 60_000) {
    reasons.push(`Pickup deadline is less than ${MIN_PICKUP_LEAD_MINUTES} minutes away`);
  }
  const missingDiet = recipient.dietaryNeeds.filter((t) => !donation.dietaryTags.includes(t));
  if (missingDiet.length > 0) {
    reasons.push(`Does not meet dietary requirement: ${missingDiet.join(", ")}`);
  }
  const conflicting = donation.allergens.filter((a) => recipient.avoidAllergens.includes(a));
  if (conflicting.length > 0) {
    reasons.push(`Contains an allergen you asked us to avoid: ${conflicting.join(", ")}`);
  }
  return { eligible: reasons.length === 0, distanceKm, reasons };
}

function distanceScore(distanceKm: number, radiusKm: number): number {
  if (radiusKm <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - distanceKm / radiusKm));
}

/** Urgent listings (little time left) rank higher so food is not wasted. */
export function deadlineScore(hoursRemaining: number): number {
  if (hoursRemaining <= 2) return 1;
  if (hoursRemaining <= 6) return 0.8;
  if (hoursRemaining <= 12) return 0.6;
  if (hoursRemaining <= 24) return 0.4;
  return 0.2;
}

export function quantityScore(quantity: number, unit: string, recipient: MatchRecipient): number {
  if (recipient.maxPickupQuantity == null || recipient.maxPickupQuantity <= 0) return 0.5;
  if (recipient.preferredUnit && recipient.preferredUnit !== unit) return 0.5;
  if (quantity <= recipient.maxPickupQuantity) return 1;
  if (quantity <= recipient.maxPickupQuantity * 2) return 0.5;
  return 0.2;
}

/** 1 when the availability window overlaps the recipient's receiving hours, otherwise 0. */
export function receivingHoursScore(
  donation: Pick<MatchDonation, "availableFrom" | "availableUntil">,
  recipient: Pick<MatchRecipient, "receivingStartHour" | "receivingEndHour">,
): number {
  const { receivingStartHour: start, receivingEndHour: end } = recipient;
  if (start == null || end == null) return 0.5;
  const fromMs = donation.availableFrom.getTime();
  const untilMs = donation.availableUntil.getTime();
  if (untilMs - fromMs >= 24 * 3600_000) return 1;
  // Walk the window hour by hour (bounded to 24 steps) and check the local clock hour.
  for (let t = fromMs; t <= untilMs; t += 3600_000) {
    const hour = new Date(t).getHours();
    const inside = start <= end ? hour >= start && hour < end : hour >= start || hour < end;
    if (inside) return 1;
  }
  return 0;
}

export function volunteerCoverageScore(donation: MatchDonation, volunteers: MatchVolunteer[]): number {
  const covering = volunteers.filter(
    (v) => v.isAvailable && haversineKm(v, donation) <= v.serviceRadiusKm,
  ).length;
  return Math.min(covering, 3) / 3;
}

export interface MatchScore {
  donationId: string;
  score: number;
  eligible: boolean;
  distanceKm: number;
  reasons: string[];
  breakdown: Record<keyof typeof MATCH_WEIGHTS, number>;
}

export function scoreDonation(
  donation: MatchDonation,
  recipient: MatchRecipient,
  volunteers: MatchVolunteer[],
  now: Date,
): MatchScore {
  const eligibility = evaluateEligibility(donation, recipient, now);
  const hoursRemaining = (donation.pickupDeadline.getTime() - now.getTime()) / 3600_000;
  const parts = {
    distance: distanceScore(eligibility.distanceKm, recipient.serviceRadiusKm),
    deadline: deadlineScore(hoursRemaining),
    quantity: quantityScore(donation.quantity, donation.unit, recipient),
    receivingHours: receivingHoursScore(donation, recipient),
    volunteerCoverage: volunteerCoverageScore(donation, volunteers),
  };
  const breakdown = {} as MatchScore["breakdown"];
  let total = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as (keyof typeof MATCH_WEIGHTS)[]) {
    breakdown[key] = Math.round(parts[key] * MATCH_WEIGHTS[key] * 10) / 10;
    total += parts[key] * MATCH_WEIGHTS[key];
  }
  return {
    donationId: donation.id,
    score: Math.round(total),
    eligible: eligibility.eligible,
    distanceKm: Math.round(eligibility.distanceKm * 10) / 10,
    reasons: eligibility.reasons,
    breakdown,
  };
}

/** Eligible matches first, then by score (descending), then nearest. */
export function rankDonations(
  donations: MatchDonation[],
  recipient: MatchRecipient,
  volunteers: MatchVolunteer[],
  now: Date,
): MatchScore[] {
  return donations
    .map((d) => scoreDonation(d, recipient, volunteers, now))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.distanceKm - b.distanceKm);
}
