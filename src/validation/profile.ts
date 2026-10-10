import { z } from "zod";
import { DIETARY_LABELS, ALLERGEN_LABELS } from "@/lib/constants";
import { latitudeSchema, longitudeSchema } from "./common";

export const DIETARY_TAG_VALUES = Object.keys(DIETARY_LABELS) as [string, ...string[]];
export const ALLERGEN_VALUES = Object.keys(ALLERGEN_LABELS) as [string, ...string[]];

const hour = z.number().int().min(0).max(23).nullable().optional();

export const organizationProfileSchema = z
  .object({
    kind: z.literal("ORGANIZATION"),
    name: z.string().trim().min(2, "Enter the organization name.").max(120),
    type: z.enum([
      "RESTAURANT", "CAFE", "HOTEL", "HOSTEL", "EVENT_ORGANIZER", "COLLEGE_CANTEEN",
      "NGO", "SHELTER", "COMMUNITY_KITCHEN", "OTHER",
    ]),
    registrationNumber: z.string().trim().max(60).optional().nullable(),
    addressLine: z.string().trim().min(5, "Enter the address for pickups or deliveries.").max(200),
    city: z.string().trim().min(2, "Enter a city.").max(80),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    phone: z.string().trim().min(7, "Enter a contact phone number.").max(20),
    description: z.string().trim().max(500).optional().nullable(),
    operatingHours: z.string().trim().max(120).optional().nullable(),
    receivingStartHour: hour,
    receivingEndHour: hour,
    serviceRadiusKm: z.coerce.number().int().min(1).max(100).default(15),
    dailyBeneficiaries: z.coerce.number().int().min(0).max(100000).optional().nullable(),
    maxPickupQuantity: z.coerce.number().min(0).max(100000).optional().nullable(),
    dietaryNeeds: z.array(z.enum(DIETARY_TAG_VALUES)).max(6).default([]),
    avoidAllergens: z.array(z.enum(ALLERGEN_VALUES)).max(9).default([]),
    applicantNote: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => (v.receivingStartHour == null) === (v.receivingEndHour == null), {
    message: "Set both receiving start and end hours, or leave both empty.",
    path: ["receivingEndHour"],
  });
export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

export const volunteerProfileSchema = z.object({
  kind: z.literal("VOLUNTEER"),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  vehicleType: z.enum(["ON_FOOT", "BICYCLE", "TWO_WHEELER", "CAR", "VAN"]),
  availability: z.string().trim().min(3, "Describe when you are usually free.").max(160),
  serviceRadiusKm: z.coerce.number().int().min(1).max(50).default(8),
  phone: z.string().trim().min(7, "Enter a phone number so partners can reach you.").max(20),
  isAvailable: z.boolean().default(true),
  applicantNote: z.string().trim().max(500).optional().nullable(),
});
export type VolunteerProfileInput = z.infer<typeof volunteerProfileSchema>;

export const profileSchema = z.discriminatedUnion("kind", [organizationProfileSchema, volunteerProfileSchema]);
export type ProfileInput = z.infer<typeof profileSchema>;
