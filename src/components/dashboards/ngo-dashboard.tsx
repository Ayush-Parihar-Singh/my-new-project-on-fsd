import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, Handshake, MapPin, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { DiscoveryMap } from "@/components/maps/discovery-map";
import { StatusBadge } from "@/components/donations/status-badge";
import { recipientDashboardData } from "@/server/services/analytics.service";
import { discoverDonations } from "@/server/services/discovery.service";
import { listRecipientClaims } from "@/server/services/claim.service";
import type { AuthUser } from "@/server/auth/session";
import { FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatNumber, relativeTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";

export async function NgoDashboard({ user }: { user: AuthUser }) {
  const [data, nearby, claims] = await Promise.all([
    recipientDashboardData(user.id),
    discoverDonations(user, { radiusKm: 25, sort: "best", page: 1, pageSize: 6 }),
    listRecipientClaims(user),
  ]);
  const c = data.counts;
  const pending = claims.filter((x) => x.status === "REQUESTED");
  const confirmed = claims.filter((x) => ["CONFIRMED", "PICKUP_IN_PROGRESS"].includes(x.status));
  const mapCenter: [number, number] = nearby.center ? [nearby.center.latitude, nearby.center.longitude] : [12.9716, 77.5946];
  const points = nearby.items
    .filter((i) => i.location)
    .map((i) => ({ id: i.id, title: i.title, latitude: i.location!.latitude, longitude: i.location!.longitude, areaLabel: i.pickupAreaLabel ?? "Nearby", exact: i.location!.exact }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Recipient dashboard"
        title="Find good food for the people who count on you."
        description={`${user.fullName}. Matches are ranked by distance, deadline, quantity fit, receiving hours and volunteer coverage.`}
        actions={
          <ButtonLink href="/discover" variant="outline">
            <MapPin /> Open discovery map
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending claims" value={formatNumber(c.pendingClaims)} hint="Waiting for donor confirmation" icon={<Clock />} tone="coral" />
        <StatCard label="Confirmed collections" value={formatNumber(c.confirmedCollections)} hint="Pickups arranged" icon={<Handshake />} tone="sage" />
        <StatCard label="Completed" value={formatNumber(c.completed)} hint="Received and recorded" icon={<CheckCircle2 />} tone="forest" />
        <StatCard
          label="Received"
          value={data.received.length ? data.received.map((r) => `${formatNumber(r.quantity)} ${r.label.toLowerCase()}`).join(" · ") : "—"}
          hint="Quantities from completed handovers"
          icon={<Sparkles />}
          tone="cream"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="nearby" className="space-y-4">
          <SectionTitle id="nearby" action={<Link href="/discover" className="text-sm font-semibold text-forest hover:underline">See all</Link>}>Nearby donations</SectionTitle>
          {nearby.items.length === 0 ? (
            <EmptyState icon={<MapPin />} title="Nothing open nearby">New listings appear here as donors post them.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {nearby.items.map((d) => (
                <li key={d.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/donations/${d.id}`} className="font-semibold text-deep hover:text-forest">{d.title}</Link>
                      <p className="mt-1 text-xs text-muted">
                        {d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""} · {FOOD_CATEGORY_LABELS[d.category as keyof typeof FOOD_CATEGORY_LABELS] ?? "Food"} · {d.pickupAreaLabel}
                        {d.distanceKm != null ? ` · ${d.distanceKm} km` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.isDemo ? <Badge tone="demo">Demo</Badge> : null}
                      {d.match ? <Badge tone={d.match.eligible ? "forest" : "neutral"}>{d.match.eligible ? `Match ${Math.round(d.match.score)}` : "Not a fit"}</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="size-3.5" aria-hidden /> Pickup by {relativeTime(d.pickupDeadline)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="map-title" className="space-y-4">
          <SectionTitle id="map-title">Discovery map</SectionTitle>
          <DiscoveryMap points={points} center={mapCenter} zoom={12} />
          <p className="text-xs text-muted">Locations are approximate for listings you have not claimed.</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Pending claims</CardTitle>
            <CardDescription>Your requests the donor has not yet confirmed.</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? <p className="text-sm text-muted">No pending claims.</p> : (
              <ul className="divide-y divide-line">
                {pending.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/donations/${d.id}`} className="truncate font-medium text-deep hover:text-forest">{d.title}</Link>
                    <StatusBadge status={d.status as DonationStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Confirmed collections</CardTitle>
            <CardDescription>Show the handover code to the volunteer on arrival.</CardDescription>
          </CardHeader>
          <CardContent>
            {confirmed.length === 0 ? <p className="text-sm text-muted">Nothing confirmed for collection right now.</p> : (
              <ul className="divide-y divide-line">
                {confirmed.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/donations/${d.id}`} className="truncate font-medium text-deep hover:text-forest">{d.title}</Link>
                    <StatusBadge status={d.status as DonationStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
