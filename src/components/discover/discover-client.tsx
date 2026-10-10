"use client";
import * as React from "react";
import Link from "next/link";
import { LocateFixed, MapPin, Clock, Star, Users, Route, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Field } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoveryMap } from "@/components/maps/discovery-map";
import { StatusBadge } from "@/components/donations/status-badge";
import { api } from "@/lib/client/api";
import { DIETARY_LABELS, FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { DonationView } from "@/domain/visibility";
import type { DonationStatus } from "@/generated/prisma/enums";

export interface DiscoverItem extends DonationView {
  distanceKm: number | null;
  match: { eligible: boolean; score: number; reasons: string[]; breakdown: Record<string, number> } | null;
}

interface Result {
  items: DiscoverItem[];
  total: number;
  page: number;
  totalPages: number;
  center: { latitude: number; longitude: number } | null;
}

export interface Viewer {
  role: "DONOR" | "NGO" | "VOLUNTEER" | "ADMIN";
  verified: boolean;
}

export function DiscoverClient({ viewer, initialItems }: { viewer: Viewer | null; initialItems: DiscoverItem[] }) {
  const [sort, setSort] = React.useState<"deadline" | "distance" | "best">(viewer?.role === "NGO" ? "best" : "deadline");
  const [radius, setRadius] = React.useState(25);
  const [category, setCategory] = React.useState("");
  const [dietary, setDietary] = React.useState("");
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [items, setItems] = React.useState<DiscoverItem[]>(initialItems);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [geoMessage, setGeoMessage] = React.useState<string | null>(null);
  const [claimingId, setClaimingId] = React.useState<string | null>(null);
  const [claimedIds, setClaimedIds] = React.useState<Set<string>>(new Set());
  const requestId = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ sort, radiusKm: String(radius), pageSize: "24" });
    if (category) qs.set("category", category);
    if (dietary) qs.set("dietary", dietary);
    if (coords) {
      qs.set("lat", String(coords.lat));
      qs.set("lng", String(coords.lng));
    }
    const res = await api<Result>("GET", `/api/discover?${qs.toString()}`);
    if (id !== requestId.current) return;
    setLoading(false);
    if (!res.ok) return setError(res.message);
    setResult(res.data);
    setItems(res.data.items);
  }, [sort, radius, category, dietary, coords]);

  // Reload when filters change, after the first render (initial data is server-rendered).
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    load();
  }, [load]);

  function locate() {
    if (!navigator.geolocation) return setGeoMessage("Your browser cannot share its location. You can still browse everything nearby by area.");
    setGeoMessage("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)) });
        setSort("distance");
        setGeoMessage(null);
      },
      () => setGeoMessage("Location permission was declined. Results are sorted by deadline instead."),
      { timeout: 10000 },
    );
  }

  async function claim(id: string) {
    setClaimingId(id);
    const res = await api("POST", `/api/donations/${id}/claim`);
    setClaimingId(null);
    if (!res.ok) return setError(res.message);
    setClaimedIds((s) => new Set(s).add(id));
  }

  const list = items;
  const mapCenter = React.useMemo<[number, number]>(() => {
    if (coords) return [coords.lat, coords.lng];
    if (result?.center) return [result.center.latitude, result.center.longitude];
    return [20.5937, 78.9629]; // India-wide view until a location is known
  }, [coords, result]);
  const canClaim = viewer?.role === "NGO" && viewer.verified;
  // Public points are already fuzzed by the server, so they are shown as approximate.
  const mapPoints = list
    .filter((d): d is DiscoverItem & { location: NonNullable<DiscoverItem["location"]> } => d.location != null)
    .map((d) => ({
      id: d.id,
      title: d.title,
      latitude: d.location.latitude,
      longitude: d.location.longitude,
      areaLabel: d.pickupAreaLabel ?? "",
      exact: d.location.exact,
    }));

  return (
    <div className="space-y-6">
      <Card className="sticky top-16 z-10 md:top-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
          <Field id="sort" label="Sort by">
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="deadline">Closest deadline</option>
              <option value="distance" disabled={!coords}>Nearest first</option>
              <option value="best" disabled={viewer?.role !== "NGO" || !viewer.verified}>Best match for my organization</option>
            </Select>
          </Field>
          <Field id="category" label="Category">
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(FOOD_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field id="dietary" label="Dietary">
            <Select id="dietary" value={dietary} onChange={(e) => setDietary(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(DIETARY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field id="radius" label="Within">
            <Select id="radius" value={String(radius)} onChange={(e) => setRadius(Number(e.target.value))}>
              {[5, 10, 25, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={locate}><LocateFixed /> {coords ? "Update location" : "Use my location"}</Button>
          </div>
        </CardContent>
        {geoMessage ? <p className="px-4 pb-3 text-xs text-muted" aria-live="polite">{geoMessage}</p> : null}
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4" aria-busy={loading}>
          <p className="text-sm text-muted" aria-live="polite">
            {loading ? "Updating results…" : `${result?.total ?? list.length} open donation${(result?.total ?? list.length) === 1 ? "" : "s"}${coords ? " near you" : ""}`}
          </p>
          {loading && !result ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState icon={<Search />} title="No open donations match these filters">
              Try a wider radius or another category. New surplus is posted throughout the day.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {list.map((d) => (
                <li key={d.id}>
                  <Card
                    className="transition-shadow"
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-forest">{FOOD_CATEGORY_LABELS[d.category as keyof typeof FOOD_CATEGORY_LABELS] ?? "Food"}</p>
                          <Link href={`/donations/${d.id}`} className="font-display text-lg font-bold text-deep hover:underline">{d.title}</Link>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {d.isDemo ? <Badge tone="demo">Demo</Badge> : null}
                          {d.match?.eligible && d.match.score >= 70 ? <Badge tone="forest"><Star className="size-3" aria-hidden /> Strong match</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
                        <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-forest" aria-hidden />{d.pickupAreaLabel}{d.distanceKm != null ? ` · ${d.distanceKm} km` : ""}</span>
                        <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-forest" aria-hidden />{d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""}</span>
                        {d.pickupDeadline ? <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-forest" aria-hidden />Pickup by {formatDateTime(d.pickupDeadline)} <span className="text-muted">({relativeTime(d.pickupDeadline)})</span></span> : null}
                      </div>
                      {d.dietaryTags.length ? <p className="text-xs text-muted">{d.dietaryTags.map((t) => DIETARY_LABELS[t]).join(" · ")}</p> : null}
                      {d.match?.reasons?.length ? (
                        <ul className="flex flex-wrap gap-1.5 text-xs text-deep">
                          {d.match.reasons.slice(0, 3).map((r) => <li key={r} className="rounded-full bg-sage px-2.5 py-1">{r}</li>)}
                        </ul>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <StatusBadge status={d.status as DonationStatus} />
                        <div className="flex gap-2">
                          <Link href={`/donations/${d.id}`} className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-forest hover:bg-forest-50">Details</Link>
                          {canClaim && d.status === "AVAILABLE" ? (
                            claimedIds.has(d.id) ? (
                              <Badge tone="forest">Request sent</Badge>
                            ) : (
                              <Button size="sm" loading={claimingId === d.id} onClick={() => claim(d.id)}>Request this food</Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {result && result.totalPages > 1 ? <p className="text-xs text-muted">Showing the first page. Narrow the filters to see more.</p> : null}
        </div>

        <div className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <DiscoveryMap points={mapPoints} center={mapCenter} zoom={coords || result?.center ? 12 : 4} />
          <p className="flex items-start gap-2 text-xs text-muted">
            <Route className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Map points are approximate. Exact pickup addresses are shared only with confirmed recipients and assigned volunteers. Map data © OpenStreetMap contributors.
          </p>
        </div>
      </div>
    </div>
  );
}
