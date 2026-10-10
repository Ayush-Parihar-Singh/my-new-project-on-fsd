"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, CheckCircle2, KeyRound, MapPin, Navigation, PackageCheck, Phone, Route, Undo2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input, Field, describedBy } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/donations/status-badge";
import { api } from "@/lib/client/api";
import { DIETARY_LABELS, FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { DonationView } from "@/domain/visibility";
import type { DonationStatus } from "@/generated/prisma/enums";

export interface DeliveryTask {
  deliveryId: string;
  deliveryStatus: "OPEN" | "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED" | "CANCELLED";
  distanceKm: number | null;
  donation: DonationView;
}

export interface BoardData {
  verified: boolean;
  isAvailable: boolean;
  profileComplete: boolean;
  available: DeliveryTask[];
  active: DeliveryTask[];
  history: DeliveryTask[];
  stats: { completed: number; failed: number; active: number };
}

type Panel = null | { kind: "fail" | "release"; deliveryId: string };

/** Volunteer task board. Each action re-checks eligibility and state on the server. */
export function DeliveryBoard({ initial }: { initial: BoardData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [codes, setCodes] = React.useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = React.useState<Record<string, string>>({});
  const [panel, setPanel] = React.useState<Panel>(null);
  const [reason, setReason] = React.useState("");

  async function act(key: string, url: string, body: unknown | undefined, ok: string) {
    setBusy(key);
    setNotice(null);
    const res = await api("POST", url, body);
    setBusy(null);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.message });
      return false;
    }
    setNotice({ tone: "success", text: ok });
    setPanel(null);
    setReason("");
    router.refresh();
    return true;
  }

  async function complete(deliveryId: string) {
    const code = (codes[deliveryId] ?? "").trim();
    if (!/^\d{4}$/.test(code)) {
      setCodeErrors((e) => ({ ...e, [deliveryId]: "Enter the 4-digit code the recipient shows you." }));
      return;
    }
    setCodeErrors((e) => ({ ...e, [deliveryId]: "" }));
    const done = await act(`complete-${deliveryId}`, `/api/deliveries/${deliveryId}/complete`, { handoverCode: code }, "Handover recorded. Thank you for moving food to people who need it.");
    if (!done) setCodeErrors((e) => ({ ...e, [deliveryId]: "That code did not match. Check with the recipient." }));
  }

  if (!initial.profileComplete) {
    return (
      <EmptyState icon={<Bike />} title="Finish your volunteer profile" action={<Link href="/profile?welcome=1" className="inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-white">Complete profile</Link>}>
        Tell us where you can travel and when you are free. Tasks near you appear after that.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      {notice ? <Alert tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Alert> : null}
      {!initial.verified ? <Alert tone="warning" title="Verification pending">You can see your profile, but you cannot accept tasks until an admin verifies it.</Alert> : null}
      {initial.verified && !initial.isAvailable ? <Alert tone="info">You are marked unavailable, so no new tasks are shown. Turn availability on in your profile.</Alert> : null}

      <section aria-labelledby="available-heading" className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 id="available-heading" className="font-display text-xl font-bold text-deep">Available near you</h2>
          <span className="text-sm text-muted">{initial.available.length} open</span>
        </div>
        {initial.available.length === 0 ? (
          <EmptyState icon={<Route />} title="No open pickups nearby">Pickups appear here once a donation is confirmed with a recipient and within your radius.</EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {initial.available.map((t) => (
              <li key={t.deliveryId}>
                <TaskCard task={t}>
                  <Button
                    loading={busy === `accept-${t.deliveryId}`}
                    disabled={!initial.verified || !initial.isAvailable}
                    onClick={() => act(`accept-${t.deliveryId}`, `/api/deliveries/${t.deliveryId}/accept`, undefined, "Accepted. Pickup instructions are below.")}
                  >
                    <PackageCheck /> Accept pickup
                  </Button>
                </TaskCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-heading" className="space-y-4">
        <h2 id="active-heading" className="font-display text-xl font-bold text-deep">My active deliveries</h2>
        {initial.active.length === 0 ? (
          <EmptyState icon={<Bike />} title="No active deliveries">Accepted pickups show here with exact pickup instructions and the handover steps.</EmptyState>
        ) : (
          <ul className="space-y-5">
            {initial.active.map((t) => {
              const picked = t.deliveryStatus === "PICKED_UP";
              const id = t.deliveryId;
              return (
                <li key={id}>
                  <Card className="border-forest/25">
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={picked ? "forest" : "sage"}>{picked ? "Picked up · deliver now" : "Assigned · go to pickup"}</Badge>
                        <StatusBadge status={t.donation.status as DonationStatus} />
                      </div>
                      <CardTitle as="h3" className="pt-2">{t.donation.title}</CardTitle>
                      <CardDescription>{t.donation.quantity} {t.donation.unit ? UNIT_LABELS[t.donation.unit as keyof typeof UNIT_LABELS] : ""} · {t.donation.category ? FOOD_CATEGORY_LABELS[t.donation.category as keyof typeof FOOD_CATEGORY_LABELS] : ""}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-3 rounded-2xl bg-cream p-4 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-forest">Pickup from</p>
                        <p className="flex items-start gap-2 font-semibold text-deep"><MapPin className="mt-0.5 size-4 shrink-0 text-coral-ink" aria-hidden /> {t.donation.pickupAddress ?? t.donation.pickupAreaLabel}</p>
                        {t.donation.donor.phone ? <p className="flex items-center gap-2"><Phone className="size-4 text-forest" aria-hidden /> <a className="font-medium text-forest hover:underline" href={`tel:${t.donation.donor.phone}`}>{t.donation.donor.phone} ({t.donation.donor.name})</a></p> : null}
                        {t.donation.location ? (
                          <a className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${t.donation.location.latitude}&mlon=${t.donation.location.longitude}#map=17/${t.donation.location.latitude}/${t.donation.location.longitude}`}>
                            <Navigation className="size-4" aria-hidden /> Open in map
                          </a>
                        ) : null}
                        <p className="flex items-center gap-2 text-muted"><Clock className="size-4" aria-hidden /> Pickup window {formatDateTime(t.donation.availableFrom)} – {formatDateTime(t.donation.availableUntil)}</p>
                        {t.donation.handlingInstructions ? <p><span className="font-semibold">Instructions: </span>{t.donation.handlingInstructions}</p> : null}
                        {t.donation.storageInstructions ? <p><span className="font-semibold">Storage: </span>{t.donation.storageInstructions}</p> : null}
                        {t.donation.dietaryTags.length ? <p className="text-xs text-muted">{t.donation.dietaryTags.map((x) => DIETARY_LABELS[x]).join(" · ")}</p> : null}
                      </div>
                      <div className="space-y-4">
                        {!picked ? (
                          <div className="space-y-3">
                            <p className="text-sm text-ink/80">When you have the food, mark it picked up. Keep it at the storage temperature in the instructions.</p>
                            <div className="flex flex-wrap gap-2">
                              <Button loading={busy === `pickup-${id}`} onClick={() => act(`pickup-${id}`, `/api/deliveries/${id}/pick-up`, undefined, "Marked as picked up. Deliver it to the recipient, then enter their code.")}>
                                <PackageCheck /> Mark picked up
                              </Button>
                              <Button variant="outline" onClick={() => setPanel(panel?.deliveryId === id && panel.kind === "release" ? null : { kind: "release", deliveryId: id })}>
                                <Undo2 /> Release task
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-2xl border border-line p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-deep"><KeyRound className="size-4 text-forest" aria-hidden /> Handover code from the recipient</p>
                            <Field id={`code-${id}`} label="4-digit code" error={codeErrors[id] ? [codeErrors[id]] : undefined} hint="Ask the recipient for the code shown on their donation page.">
                              <Input
                                id={`code-${id}`}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                className="max-w-[10rem] font-mono text-2xl tracking-[0.4em]"
                                value={codes[id] ?? ""}
                                onChange={(e) => setCodes((c) => ({ ...c, [id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                invalid={!!codeErrors[id]}
                                describedBy={describedBy(`code-${id}`, "c", codeErrors[id] ? [codeErrors[id]] : undefined)}
                              />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                              <Button loading={busy === `complete-${id}`} onClick={() => complete(id)}><CheckCircle2 /> Complete handover</Button>
                              <Button variant="outline" onClick={() => setPanel(panel?.deliveryId === id && panel.kind === "fail" ? null : { kind: "fail", deliveryId: id })}><XCircle /> Report a problem</Button>
                            </div>
                          </div>
                        )}

                        {panel?.deliveryId === id && (panel.kind === "fail" || panel.kind === "release") ? (
                          <form
                            className="space-y-3 rounded-2xl border border-line bg-cream p-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (panel.kind === "fail") act(`fail-${id}`, `/api/deliveries/${id}/fail`, { reason }, "Reported. The donor and recipient have been told.");
                              else act(`release-${id}`, `/api/deliveries/${id}/release`, undefined, "Task released. Other volunteers can now pick it up.");
                            }}
                          >
                            {panel.kind === "fail" ? (
                              <Field id={`reason-${id}`} label="What went wrong?" hint="For example: recipient unreachable at the window, food not ready. At least 5 characters.">
                                <Input id={`reason-${id}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                              </Field>
                            ) : (
                              <p className="text-sm text-ink/80">Release this task if you can no longer collect it. It returns to the open list for another volunteer.</p>
                            )}
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" variant={panel.kind === "fail" ? "danger" : "primary"} loading={busy === `${panel.kind}-${id}`} disabled={panel.kind === "fail" && reason.trim().length < 5}>
                                {panel.kind === "fail" ? "Submit report" : "Release task"}
                              </Button>
                              <Button size="sm" variant="ghost" type="button" onClick={() => setPanel(null)}>Cancel</Button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="history-heading" className="font-display text-xl font-bold text-deep">Contribution history</h2>
          <p className="text-sm text-muted">{initial.stats.completed} completed · {initial.stats.failed} reported · {initial.stats.active} active</p>
        </div>
        {initial.history.length === 0 ? (
          <p className="text-sm text-muted">Your completed and reported deliveries will be listed here.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {initial.history.map((t) => (
              <li key={t.deliveryId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-deep">{t.donation.title}</p>
                  <p className="text-xs text-muted">{t.donation.updatedAt ? `${formatDateTime(t.donation.updatedAt)} · ${relativeTime(t.donation.updatedAt)}` : ""}</p>
                </div>
                <Badge tone={t.deliveryStatus === "DELIVERED" ? "forest" : "danger"}>{t.deliveryStatus === "DELIVERED" ? "Delivered" : "Reported"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskCard({ task, children }: { task: DeliveryTask; children: React.ReactNode }) {
  const d = task.donation;
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest">{d.category ? FOOD_CATEGORY_LABELS[d.category as keyof typeof FOOD_CATEGORY_LABELS] : "Food"}</p>
          {task.distanceKm != null ? <Badge tone="sage">{task.distanceKm} km away</Badge> : null}
        </div>
        <h3 className="font-display text-lg font-bold text-deep">{d.title}</h3>
        <p className="flex items-center gap-2 text-sm text-ink/80"><MapPin className="size-4 text-forest" aria-hidden /> {d.pickupAreaLabel}</p>
        <p className="text-sm text-ink/80">{d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""}</p>
        {d.pickupDeadline ? <p className="text-xs text-muted">Pickup by {formatDateTime(d.pickupDeadline)}</p> : null}
        <div className="mt-auto pt-2">{children}</div>
      </CardContent>
    </Card>
  );
}
