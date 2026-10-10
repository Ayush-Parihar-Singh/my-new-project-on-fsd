// Shared, client-safe vocabulary. Keep free of server-only imports.
import type { DonationStatus, FoodCategory, OrgType, QuantityUnit, Role, VehicleType, VerificationStatus } from "@/generated/prisma/enums";

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  COOKED_MEALS: "Cooked meals",
  BAKERY: "Bakery",
  FRESH_PRODUCE: "Fresh produce",
  DAIRY: "Dairy",
  BEVERAGES: "Beverages",
  PACKAGED_GOODS: "Packaged goods",
  DESSERTS: "Desserts & sweets",
  OTHER: "Other",
};

export const UNIT_LABELS: Record<QuantityUnit, string> = {
  KG: "kg",
  LITRES: "litres",
  PORTIONS: "portions",
  PACKS: "packs",
  PIECES: "pieces",
};

export const DIETARY_LABELS: Record<string, string> = {
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  HALAL: "Halal",
  JAIN_FRIENDLY: "Jain-friendly",
  GLUTEN_FREE: "Gluten-free",
  NON_VEGETARIAN: "Contains non-vegetarian",
};

export const ALLERGEN_LABELS: Record<string, string> = {
  PEANUTS: "Peanuts",
  TREE_NUTS: "Tree nuts",
  DAIRY: "Dairy / milk",
  EGGS: "Eggs",
  GLUTEN: "Gluten / wheat",
  SOY: "Soy",
  FISH: "Fish",
  SHELLFISH: "Shellfish",
  SESAME: "Sesame",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Cafe",
  HOTEL: "Hotel",
  HOSTEL: "Hostel",
  EVENT_ORGANIZER: "Event organizer",
  COLLEGE_CANTEEN: "College canteen",
  NGO: "Nonprofit (NGO)",
  SHELTER: "Shelter",
  COMMUNITY_KITCHEN: "Community kitchen",
  OTHER: "Other",
};

export const DONOR_ORG_TYPES: OrgType[] = ["RESTAURANT", "CAFE", "HOTEL", "HOSTEL", "EVENT_ORGANIZER", "COLLEGE_CANTEEN", "OTHER"];
export const RECIPIENT_ORG_TYPES: OrgType[] = ["NGO", "SHELTER", "COMMUNITY_KITCHEN", "OTHER"];

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  ON_FOOT: "On foot",
  BICYCLE: "Bicycle",
  TWO_WHEELER: "Two-wheeler",
  CAR: "Car",
  VAN: "Van / larger vehicle",
};

export const ROLE_LABELS: Record<Role, string> = {
  DONOR: "Donor",
  NGO: "Recipient (NGO)",
  VOLUNTEER: "Volunteer",
  ADMIN: "Admin",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Needs attention",
};

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  REQUESTED: "Claim requested",
  CONFIRMED: "Confirmed",
  PICKUP_IN_PROGRESS: "Pickup in progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  FAILED_HANDOVER: "Failed handover",
};

export const DONATION_STATUS_TONE: Record<DonationStatus, "neutral" | "sage" | "amber" | "forest" | "coral" | "danger"> = {
  DRAFT: "neutral",
  AVAILABLE: "sage",
  REQUESTED: "amber",
  CONFIRMED: "forest",
  PICKUP_IN_PROGRESS: "forest",
  COMPLETED: "forest",
  REJECTED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  FAILED_HANDOVER: "danger",
};

export const ACTIVE_STATUSES: DonationStatus[] = ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS"];
export const CLOSED_STATUSES: DonationStatus[] = ["COMPLETED", "REJECTED", "CANCELLED", "EXPIRED", "FAILED_HANDOVER"];

export const APP_NAME = "LastPlate";
export const TAGLINE = "Good Food Deserves Another Chance";
