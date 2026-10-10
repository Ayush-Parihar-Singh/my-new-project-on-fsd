// Maps persistence records to the plain input types used by the pure matching domain.
import type { MatchDonation, MatchRecipient } from "@/domain/matching";

export function toMatchDonation(d: {
  id: string;
  quantity: number | null;
  unit: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  pickupDeadline: Date | null;
  availableFrom: Date | null;
  availableUntil: Date | null;
  dietaryTags: string[];
  allergens: string[];
}): MatchDonation {
  return {
    id: d.id,
    quantity: d.quantity ?? 0,
    unit: d.unit ?? "PIECES",
    latitude: d.pickupLatitude ?? 0,
    longitude: d.pickupLongitude ?? 0,
    pickupDeadline: d.pickupDeadline ?? new Date(0),
    availableFrom: d.availableFrom ?? new Date(0),
    availableUntil: d.availableUntil ?? new Date(0),
    dietaryTags: d.dietaryTags,
    allergens: d.allergens,
  };
}

export function toMatchRecipient(o: {
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  receivingStartHour: number | null;
  receivingEndHour: number | null;
  dietaryNeeds: string[];
  avoidAllergens: string[];
  maxPickupQuantity: number | null;
}): MatchRecipient {
  return {
    latitude: o.latitude,
    longitude: o.longitude,
    serviceRadiusKm: o.serviceRadiusKm,
    receivingStartHour: o.receivingStartHour,
    receivingEndHour: o.receivingEndHour,
    dietaryNeeds: o.dietaryNeeds,
    avoidAllergens: o.avoidAllergens,
    maxPickupQuantity: o.maxPickupQuantity,
  };
}
