import type { DonationFormValues } from "@/validation/donation";
import type { DonationView } from "@/domain/visibility";
import { toLocalInput } from "@/components/donations/donation-wizard";

export function emptyDonationValues(): DonationFormValues {
  return {
    title: "",
    description: "",
    category: undefined as unknown as DonationFormValues["category"],
    quantity: undefined as unknown as number,
    unit: undefined as unknown as DonationFormValues["unit"],
    preparedAt: "",
    dietaryTags: [],
    allergens: [],
    allergenNotes: "",
    pickupAddressLine: "",
    pickupCity: "",
    pickupLatitude: undefined as unknown as number,
    pickupLongitude: undefined as unknown as number,
    pickupAreaLabel: "",
    availableFrom: "",
    availableUntil: "",
    pickupDeadline: "",
    storageInstructions: "",
    handlingInstructions: "",
  };
}

/** Maps a stored donation (owner view, with exact fields) into form values. */
export function donationToFormValues(d: DonationView): DonationFormValues {
  return {
    ...emptyDonationValues(),
    title: d.title,
    description: d.description,
    category: (d.category ?? undefined) as DonationFormValues["category"],
    quantity: d.quantity ?? (undefined as unknown as number),
    unit: (d.unit ?? undefined) as DonationFormValues["unit"],
    preparedAt: toLocalInput(d.preparedAt),
    dietaryTags: d.dietaryTags as DonationFormValues["dietaryTags"],
    allergens: d.allergens as DonationFormValues["allergens"],
    allergenNotes: d.allergenNotes ?? "",
    pickupAddressLine: d.pickupAddress ?? "",
    pickupCity: d.pickupCity ?? "",
    pickupLatitude: d.location?.latitude ?? (undefined as unknown as number),
    pickupLongitude: d.location?.longitude ?? (undefined as unknown as number),
    pickupAreaLabel: d.pickupAreaLabel ?? "",
    availableFrom: toLocalInput(d.availableFrom),
    availableUntil: toLocalInput(d.availableUntil),
    pickupDeadline: toLocalInput(d.pickupDeadline),
    storageInstructions: d.storageInstructions ?? "",
    handlingInstructions: d.handlingInstructions ?? "",
  };
}
