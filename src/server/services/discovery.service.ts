// "Find food near me": public discovery, personalised ranking for verified recipients.
// Public responses use fuzzed coordinates; only the match score is derived from exact locations.
import { haversineKm } from "@/domain/geo";
import { rankDonations } from "@/domain/matching";
import { toDonationView, type DonationView } from "@/domain/visibility";
import { paginate, type Paginated } from "@/lib/http";
import type { DiscoverQueryInput } from "@/validation/operations";
import type { AuthUser } from "../auth/session";
import * as donationsRepo from "../repositories/donations.repo";
import * as users from "../repositories/users.repo";
import { toMatchDonation, toMatchRecipient } from "./matching-adapters";
import { maybeRunExpirationSweep } from "./expiration.service";
import { viewerOf } from "./viewer";

export type DiscoveredDonation = DonationView & {
  distanceKm: number | null;
  match: { eligible: boolean; score: number; reasons: string[]; breakdown: Record<string, number> } | null;
};

export async function discoverDonations(
  viewer: AuthUser | null,
  q: DiscoverQueryInput,
): Promise<Paginated<DiscoveredDonation> & { center: { latitude: number; longitude: number } | null }> {
  await maybeRunExpirationSweep();
  const now = new Date();
  const rows = await donationsRepo.findAvailableForDiscovery({ category: q.category, dietary: q.dietary, now });

  let center: { latitude: number; longitude: number } | null = q.lat != null && q.lng != null ? { latitude: q.lat, longitude: q.lng } : null;
  let recipient = null;
  if (viewer?.role === "NGO" && viewer.verificationStatus === "VERIFIED") {
    const full = await users.findUserById(viewer.id);
    if (full?.organization) {
      recipient = toMatchRecipient(full.organization);
      center ??= { latitude: full.organization.latitude, longitude: full.organization.longitude };
    }
  }

  const withCoords = rows.filter((r) => r.pickupLatitude != null && r.pickupLongitude != null);
  const scores = recipient
    ? new Map(
        rankDonations(
          withCoords.map((r) => toMatchDonation(r)),
          recipient,
          (await users.findVerifiedVolunteers()).map((v) => ({
            latitude: v.latitude,
            longitude: v.longitude,
            serviceRadiusKm: v.serviceRadiusKm,
            isAvailable: v.isAvailable,
          })),
          now,
        ).map((s) => [s.donationId, s] as const),
      )
    : new Map();

  let items: DiscoveredDonation[] = rows.map((r) => {
    const distance = center && r.pickupLatitude != null && r.pickupLongitude != null
      ? Math.round(haversineKm(center, { latitude: r.pickupLatitude, longitude: r.pickupLongitude }) * 10) / 10
      : null;
    const s = scores.get(r.id);
    return {
      ...toDonationView(r, viewerOf(viewer)),
      distanceKm: distance,
      match: s ? { eligible: s.eligible, score: s.score, reasons: s.reasons, breakdown: s.breakdown } : null,
    };
  });

  if (center) items = items.filter((i) => i.distanceKm == null || i.distanceKm <= q.radiusKm);
  if (q.sort === "distance") items.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  else if (q.sort === "best") items.sort((a, b) => Number(b.match?.eligible ?? 0) - Number(a.match?.eligible ?? 0) || (b.match?.score ?? 0) - (a.match?.score ?? 0));
  else items.sort((a, b) => (a.pickupDeadline ?? "").localeCompare(b.pickupDeadline ?? ""));

  const total = items.length;
  const start = (q.page - 1) * q.pageSize;
  return { ...paginate(items.slice(start, start + q.pageSize), total, q.page, q.pageSize), center };
}
