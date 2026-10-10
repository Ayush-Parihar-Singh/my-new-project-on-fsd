// Privacy rules. Serializing a donation for an API response MUST go through these
// helpers so that private addresses, phone numbers and handover codes never leak.
import type { DonationStatus, Role, VerificationStatus } from "@/generated/prisma/enums";
import { decryptSecret } from "@/lib/crypto";
import { approximateLocation } from "./geo";

export type Viewer = { id: string; role: Role; verificationStatus: VerificationStatus } | null;

export interface DonationRecord {
  id: string;
  donorId: string;
  status: DonationStatus;
  title: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  preparedAt: Date | null;
  dietaryTags: string[];
  allergens: string[];
  allergenNotes: string | null;
  pickupAddressLine: string;
  pickupCity: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  pickupAreaLabel: string;
  availableFrom: Date | null;
  availableUntil: Date | null;
  pickupDeadline: Date | null;
  storageInstructions: string | null;
  handlingInstructions: string | null;
  version: number;
  isDemo: boolean;
  claimedById: string | null;
  claimedAt: Date | null;
  confirmedAt: Date | null;
  handoverCodeCipher: string | null;
  pickupStartedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  expiredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  publishedAt: Date | null;
  duplicateFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  donor: {
    fullName: string;
    phone: string | null;
    verificationStatus: string;
    organization: { name: string; type: string; phone: string; addressLine: string; city: string } | null;
  };
  claimant: {
    fullName: string;
    phone: string | null;
    organization: { name: string; type: string; phone: string; addressLine: string; city: string; receivingStartHour: number | null; receivingEndHour: number | null } | null;
  } | null;
  photos: { id: string; mimeType: string }[];
  delivery: {
    id: string;
    status: string;
    volunteerId: string | null;
    assignedAt: Date | null;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    volunteer: { fullName: string; volunteerProfile: { vehicleType: string } | null } | null;
  } | null;
}

/**
 * Access level for one donation:
 * - FULL: admin or the donor who owns it (exact address, contact details, photos, history)
 * - PARTICIPANT: the claiming recipient or assigned volunteer, only once the handover is active
 * - PUBLIC: anyone (including anonymous visitors) - approximate location and listing details only
 */
export type AccessLevel = "FULL" | "PARTICIPANT" | "PUBLIC";

const PARTICIPANT_STATUSES: DonationStatus[] = ["CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "FAILED_HANDOVER", "CANCELLED"];

export function accessLevel(
  viewer: Viewer,
  d: { donorId: string; claimedById: string | null; status: DonationStatus; delivery: { volunteerId: string | null; status: string } | null },
): AccessLevel {
  if (!viewer) return "PUBLIC";
  if (viewer.role === "ADMIN" || viewer.id === d.donorId) return "FULL";
  const isClaimant = d.claimedById === viewer.id && viewer.role === "NGO";
  const isVolunteer = d.delivery?.volunteerId === viewer.id && viewer.role === "VOLUNTEER";
  if (isClaimant && PARTICIPANT_STATUSES.includes(d.status)) return "PARTICIPANT";
  if (isVolunteer && d.delivery && ["ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED"].includes(d.delivery.status)) return "PARTICIPANT";
  return "PUBLIC";
}

export interface DonationView {
  id: string;
  status: DonationStatus;
  access: AccessLevel;
  title: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  preparedAt: string | null;
  dietaryTags: string[];
  allergens: string[];
  allergenNotes: string | null;
  storageInstructions: string | null;
  handlingInstructions: string | null;
  pickupAreaLabel: string;
  pickupCity: string;
  /** Exact coordinates for FULL/PARTICIPANT viewers, fuzzed for PUBLIC viewers. */
  location: { latitude: number; longitude: number; exact: boolean } | null;
  pickupAddress: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  pickupDeadline: string | null;
  version: number;
  isDemo: boolean;
  duplicateFlagged: boolean;
  publishedAt: string | null;
  claimedAt: string | null;
  confirmedAt: string | null;
  pickupStartedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  expiredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  donor: { name: string; type: string | null; verified: boolean; contactName?: string; phone?: string | null };
  claimant: { name: string; type: string | null; phone?: string | null; addressLine?: string; receivingWindow?: string | null; isViewerClaimant: boolean } | null;
  delivery: {
    id: string;
    status: string;
    volunteerName: string | null;
    vehicleType: string | null;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
  } | null;
  /** Four-digit handover code. Only the claiming recipient sees it once the donation is confirmed. */
  handoverCode: string | null;
  photos: { id: string; url: string }[];
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function receivingWindow(start: number | null, end: number | null): string | null {
  if (start == null || end == null) return null;
  const f = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${f(start)}–${f(end)}`;
}

export function toDonationView(d: DonationRecord, viewer: Viewer): DonationView {
  const verifiedDonor = d.donor.verificationStatus === "VERIFIED";
  const access = accessLevel(viewer, d);
  const full = access === "FULL";
  const participant = access !== "PUBLIC";
  const hasCoords = d.pickupLatitude != null && d.pickupLongitude != null;
  const location = !hasCoords
    ? null
    : participant
      ? { latitude: d.pickupLatitude!, longitude: d.pickupLongitude!, exact: true }
      : { ...approximateLocation({ latitude: d.pickupLatitude!, longitude: d.pickupLongitude! }, d.id), exact: false };

  const isClaimantViewer = viewer?.role === "NGO" && d.claimedById === viewer.id;
  const showHandoverCode =
    isClaimantViewer && d.handoverCodeCipher && ["CONFIRMED", "PICKUP_IN_PROGRESS"].includes(d.status);

  // Donor identity (organization name) is public. Contact details are shared only with the
  // owner, and with participants once the donor has confirmed the handover.
  const handoverActive = ["CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "FAILED_HANDOVER", "CANCELLED"].includes(d.status);
  const donorContactForParticipant = participant && handoverActive;
  const claimantContactVisible = full || isClaimantViewer;
  const donorContact = full
    ? { contactName: d.donor.fullName, phone: d.donor.phone }
    : donorContactForParticipant
      ? { contactName: d.donor.fullName, phone: d.donor.organization?.phone ?? d.donor.phone }
      : {};

  const view: DonationView = {
    id: d.id,
    status: d.status,
    access,
    title: d.title,
    description: d.description,
    category: d.category,
    quantity: d.quantity,
    unit: d.unit,
    preparedAt: iso(d.preparedAt),
    dietaryTags: d.dietaryTags,
    allergens: d.allergens,
    allergenNotes: d.allergenNotes,
    storageInstructions: d.storageInstructions,
    handlingInstructions: participant ? d.handlingInstructions : null,
    pickupAreaLabel: d.pickupAreaLabel,
    pickupCity: d.pickupCity,
    location,
    pickupAddress: participant ? d.pickupAddressLine : null,
    availableFrom: iso(d.availableFrom),
    availableUntil: iso(d.availableUntil),
    pickupDeadline: iso(d.pickupDeadline),
    version: d.version,
    isDemo: d.isDemo,
    duplicateFlagged: full ? d.duplicateFlagged : false,
    publishedAt: iso(d.publishedAt),
    claimedAt: participant || full ? iso(d.claimedAt) : null,
    confirmedAt: iso(d.confirmedAt),
    pickupStartedAt: iso(d.pickupStartedAt),
    completedAt: iso(d.completedAt),
    cancelledAt: iso(d.cancelledAt),
    cancellationReason: participant || full ? d.cancellationReason : null,
    expiredAt: iso(d.expiredAt),
    failedAt: iso(d.failedAt),
    failureReason: participant || full ? d.failureReason : null,
    rejectionReason: full ? d.rejectionReason : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    donor: {
      name: d.donor.organization?.name ?? d.donor.fullName,
      type: d.donor.organization?.type ?? null,
      verified: verifiedDonor,
      ...donorContact,
    },
    claimant: d.claimant
      ? {
          name: d.claimant.organization?.name ?? d.claimant.fullName,
          type: d.claimant.organization?.type ?? null,
          isViewerClaimant: isClaimantViewer,
          ...(participant || full
            ? {
                addressLine: d.claimant.organization?.addressLine,
                receivingWindow: receivingWindow(d.claimant.organization?.receivingStartHour ?? null, d.claimant.organization?.receivingEndHour ?? null),
              }
            : {}),
          ...(claimantContactVisible ? { phone: d.claimant.organization?.phone ?? d.claimant.phone } : {}),
        }
      : null,
    delivery: d.delivery
      ? {
          id: d.delivery.id,
          status: d.delivery.status,
          volunteerName: participant || full ? d.delivery.volunteer?.fullName ?? null : null,
          vehicleType: participant || full ? d.delivery.volunteer?.volunteerProfile?.vehicleType ?? null : null,
          assignedAt: iso(d.delivery.assignedAt),
          pickedUpAt: iso(d.delivery.pickedUpAt),
          deliveredAt: iso(d.delivery.deliveredAt),
        }
      : null,
    handoverCode: showHandoverCode ? decryptSecret(d.handoverCodeCipher!) : null,
    photos: full || access === "PARTICIPANT" ? d.photos.map((p) => ({ id: p.id, url: `/api/files/photos/${p.id}` })) : [],
  };
  return view;
}
