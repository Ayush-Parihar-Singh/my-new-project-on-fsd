import { z } from "zod";
import { ALLERGEN_VALUES, DIETARY_TAG_VALUES } from "./profile";
import { isoDateSchema } from "./common";

export const FOOD_CATEGORY_VALUES = [
  "COOKED_MEALS", "BAKERY", "FRESH_PRODUCE", "DAIRY", "BEVERAGES", "PACKAGED_GOODS", "DESSERTS", "OTHER",
] as const;
export const UNIT_VALUES = ["KG", "LITRES", "PORTIONS", "PACKS", "PIECES"] as const;

export const DONATION_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 10, max: 1000 },
  quantity: { min: 0.1, max: 100000 },
  pickupAddress: { min: 5, max: 200 },
  pickupAreaLabel: { min: 3, max: 80 },
  notes: 300,
  maxPhotos: 5,
} as const;

/**
 * Form model used by the multi-step donation wizard. Dates are datetime-local strings
 * converted to ISO on submit (see `toDonationPayload`). Full validation happens here
 * and again on the server.
 */
export const donationFormSchema = z
  .object({
    title: z.string().trim().min(DONATION_LIMITS.title.min, "Give the food a short name.").max(DONATION_LIMITS.title.max),
    description: z
      .string()
      .trim()
      .min(DONATION_LIMITS.description.min, "Describe the food in a sentence or two.")
      .max(DONATION_LIMITS.description.max),
    category: z.enum(FOOD_CATEGORY_VALUES, { message: "Choose a category." }),
    quantity: z.number({ message: "Enter a quantity." }).min(DONATION_LIMITS.quantity.min, "Quantity must be greater than zero.").max(DONATION_LIMITS.quantity.max),
    unit: z.enum(UNIT_VALUES, { message: "Choose a unit." }),
    preparedAt: z.string().optional().nullable(),
    dietaryTags: z.array(z.enum(DIETARY_TAG_VALUES)).max(6),
    allergens: z.array(z.enum(ALLERGEN_VALUES)).max(9),
    allergenNotes: z.string().trim().max(DONATION_LIMITS.notes).optional().nullable(),
    pickupAddressLine: z.string().trim().min(DONATION_LIMITS.pickupAddress.min, "Enter the full pickup address.").max(DONATION_LIMITS.pickupAddress.max),
    pickupCity: z.string().trim().min(2, "Enter the city.").max(80),
    pickupLatitude: z.number({ message: "Pin the pickup location on the map." }).min(-90).max(90),
    pickupLongitude: z.number({ message: "Pin the pickup location on the map." }).min(-180).max(180),
    pickupAreaLabel: z
      .string()
      .trim()
      .min(DONATION_LIMITS.pickupAreaLabel.min, "Add a neighbourhood label that is safe to show publicly.")
      .max(DONATION_LIMITS.pickupAreaLabel.max),
    availableFrom: z.string().min(1, "Choose when pickup can start."),
    availableUntil: z.string().min(1, "Choose when pickup window closes."),
    pickupDeadline: z.string().min(1, "Choose the latest pickup time."),
    storageInstructions: z.string().trim().max(DONATION_LIMITS.notes).optional().nullable(),
    handlingInstructions: z.string().trim().max(DONATION_LIMITS.notes).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.availableUntil && v.availableFrom && new Date(v.availableUntil) <= new Date(v.availableFrom)) {
      ctx.addIssue({ code: "custom", path: ["availableUntil"], message: "The window must end after it starts." });
    }
    if (v.pickupDeadline && v.availableUntil && new Date(v.pickupDeadline) < new Date(v.availableUntil)) {
      ctx.addIssue({ code: "custom", path: ["pickupDeadline"], message: "The deadline must be on or after the end of the window." });
    }
  });
export type DonationFormValues = z.infer<typeof donationFormSchema>;

/** Server payload for create/update. Everything optional so drafts can be saved partially. */
export const donationWriteSchema = z.object({
  title: z.string().trim().max(DONATION_LIMITS.title.max).optional(),
  description: z.string().trim().max(DONATION_LIMITS.description.max).optional(),
  category: z.enum(FOOD_CATEGORY_VALUES).nullable().optional(),
  quantity: z.number().min(0).max(DONATION_LIMITS.quantity.max).nullable().optional(),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  preparedAt: isoDateSchema.nullable().optional(),
  dietaryTags: z.array(z.enum(DIETARY_TAG_VALUES)).max(6).optional(),
  allergens: z.array(z.enum(ALLERGEN_VALUES)).max(9).optional(),
  allergenNotes: z.string().trim().max(DONATION_LIMITS.notes).nullable().optional(),
  pickupAddressLine: z.string().trim().max(DONATION_LIMITS.pickupAddress.max).optional(),
  pickupCity: z.string().trim().max(80).optional(),
  pickupLatitude: z.number().min(-90).max(90).nullable().optional(),
  pickupLongitude: z.number().min(-180).max(180).nullable().optional(),
  pickupAreaLabel: z.string().trim().max(DONATION_LIMITS.pickupAreaLabel.max).optional(),
  availableFrom: isoDateSchema.nullable().optional(),
  availableUntil: isoDateSchema.nullable().optional(),
  pickupDeadline: isoDateSchema.nullable().optional(),
  storageInstructions: z.string().trim().max(DONATION_LIMITS.notes).nullable().optional(),
  handlingInstructions: z.string().trim().max(DONATION_LIMITS.notes).nullable().optional(),
  expectedVersion: z.number().int().min(1).optional(),
});
export type DonationWriteInput = z.infer<typeof donationWriteSchema>;

export const publishSchema = z.object({
  acknowledgeDuplicate: z.boolean().optional().default(false),
});

export const cancelDonationSchema = z.object({
  reason: z.string().trim().min(3, "Tell partners briefly why you are cancelling.").max(300),
});

/** Converts validated form values into the JSON payload the API expects. */
export function toDonationPayload(values: DonationFormValues): DonationWriteInput {
  const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
  return {
    ...values,
    preparedAt: iso(values.preparedAt ?? null),
    availableFrom: iso(values.availableFrom),
    availableUntil: iso(values.availableUntil),
    pickupDeadline: iso(values.pickupDeadline),
    allergenNotes: values.allergenNotes || null,
    storageInstructions: values.storageInstructions || null,
    handlingInstructions: values.handlingInstructions || null,
  };
}

export interface StoredDonationForPublish {
  title: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  pickupAddressLine: string;
  pickupCity: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  pickupAreaLabel: string;
  availableFrom: Date | null;
  availableUntil: Date | null;
  pickupDeadline: Date | null;
}

/** Returns field-level problems that prevent publishing. An empty object means ready. */
export function publishReadinessErrors(d: StoredDonationForPublish, now: Date): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const need = (key: string, ok: boolean, message: string) => {
    if (!ok) errors[key] = [...(errors[key] ?? []), message];
  };
  need("title", d.title.length >= DONATION_LIMITS.title.min, "Add a short name for the food.");
  need("description", d.description.length >= DONATION_LIMITS.description.min, "Add a description (at least 10 characters).");
  need("category", !!d.category, "Choose a category.");
  need("quantity", d.quantity != null && d.quantity > 0, "Enter a quantity greater than zero.");
  need("unit", !!d.unit, "Choose a unit.");
  need("pickupAddressLine", d.pickupAddressLine.length >= DONATION_LIMITS.pickupAddress.min, "Enter the pickup address.");
  need("pickupCity", d.pickupCity.length >= 2, "Enter the pickup city.");
  need("pickupLatitude", d.pickupLatitude != null && d.pickupLongitude != null, "Pin the pickup location on the map.");
  need("pickupAreaLabel", d.pickupAreaLabel.length >= DONATION_LIMITS.pickupAreaLabel.min, "Add a public neighbourhood label.");
  need("availableFrom", !!d.availableFrom, "Choose when pickup can start.");
  need("availableUntil", !!d.availableUntil, "Choose when the pickup window closes.");
  need("pickupDeadline", !!d.pickupDeadline, "Choose the latest pickup time.");
  if (d.availableFrom && d.availableUntil) {
    need("availableUntil", d.availableUntil > d.availableFrom, "The window must end after it starts.");
  }
  if (d.availableUntil && d.pickupDeadline) {
    need("pickupDeadline", d.pickupDeadline >= d.availableUntil, "The deadline must be on or after the window ends.");
  }
  if (d.pickupDeadline) {
    need("pickupDeadline", d.pickupDeadline.getTime() > now.getTime() + 60 * 60_000, "The pickup deadline must be at least one hour from now.");
  }
  return errors;
}
