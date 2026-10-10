import type { DonationStatus } from "@/generated/prisma/enums";

/** Statuses from which the donor may cancel. PICKUP_IN_PROGRESS is excluded on purpose. */
export const CANCELLABLE_STATUSES_FOR_DONOR: DonationStatus[] = ["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED"];
