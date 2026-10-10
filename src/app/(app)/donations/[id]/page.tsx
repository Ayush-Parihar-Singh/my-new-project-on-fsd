import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Clock, KeyRound, MapPin, Phone, Store, Info, CheckCircle2 } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { donationHistory, getDonationForViewer } from "@/server/services/donation.service";
import { NotFoundError } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/donations/status-badge";
import { DonationActions } from "@/components/donations/donation-actions";
import { PhotoGallery } from "@/components/donations/photo-gallery";
import { ButtonLink } from "@/components/ui/button";
import { ALLERGEN_LABELS, DIETARY_LABELS, DONATION_STATUS_LABELS, FOOD_CATEGORY_LABELS, UNIT_LABELS, ORG_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function DonationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const { published } = await searchParams;
  let d;
  try {
    d = await getDonationForViewer(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const history = await donationHistory(user, id);
  // Admins also receive full access, but they are not the owner, so the role check is required.
  const isOwner = d.access === "FULL" && user.role === "DONOR";
  const isClaimant = !!d.claimant?.isViewerClaimant;
  const exact = d.access !== "PUBLIC";
  const unit = d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : "";

  return (
    <div className="space-y-8">
      {published ? <Alert tone="success" title="Donation published">Verified recipients nearby can now see and claim it. You will be notified as soon as someone requests it.</Alert> : null}
      <PageHeader
        eyebrow={FOOD_CATEGORY_LABELS[d.category as keyof typeof FOOD_CATEGORY_LABELS] ?? "Donation"}
        title={d.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status as DonationStatus} />
            {d.isDemo ? <Badge tone="demo">Demo listing · fictional data</Badge> : null}
            {d.duplicateFlagged ? <Badge tone="amber">Flagged for review</Badge> : null}
            {d.pickupDeadline ? <span className="text-sm text-muted">Pickup by {formatDateTime(d.pickupDeadline)} ({relativeTime(d.pickupDeadline)})</span> : null}
          </span>
        }
        actions={isOwner ? <ButtonLink href="/donations" variant="ghost">All my donations</ButtonLink> : <ButtonLink href="/discover" variant="ghost">Back to discovery</ButtonLink>}
      />

      {d.handoverCode ? (
        <Card className="border-forest/30 bg-sage-light">
          <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-forest text-white"><KeyRound className="size-6" aria-hidden /></span>
              <div>
                <p className="text-sm font-semibold text-deep">Your handover code</p>
                <p className="text-xs text-muted">Show this to the volunteer when they arrive. They enter it to complete the handover. Do not share it before pickup.</p>
              </div>
            </div>
            <p aria-label={`Handover code ${d.handoverCode.split("").join(" ")}`} className="font-display text-5xl font-extrabold tracking-[0.3em] text-deep tabular-nums">{d.handoverCode}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle as="h2">About this food</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <p className="whitespace-pre-line leading-relaxed text-ink/85">{d.description}</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs uppercase tracking-wider text-muted">Quantity</dt><dd className="font-semibold">{d.quantity} {unit}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted">Prepared</dt><dd className="font-semibold">{d.preparedAt ? formatDateTime(d.preparedAt) : "Not stated"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted">Dietary</dt><dd className="font-semibold">{d.dietaryTags.length ? d.dietaryTags.map((t) => DIETARY_LABELS[t]).join(", ") : "Not stated"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted">Allergens</dt><dd className="font-semibold">{d.allergens.length ? d.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ") : "None stated"}</dd></div>
                {d.allergenNotes ? <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-muted">Allergen notes</dt><dd>{d.allergenNotes}</dd></div> : null}
                {d.storageInstructions ? <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-muted">Storage</dt><dd>{d.storageInstructions}</dd></div> : null}
              </dl>
              <div className="pt-2">
                <h3 className="mb-3 text-sm font-semibold text-deep">Photos</h3>
                <PhotoGallery photos={d.photos} title={d.title} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2"><MapPin className="size-5 text-forest" aria-hidden /> Pickup</CardTitle>
              <CardDescription>{exact ? "Exact details are shared with you because you are part of this handover." : "The exact address is shared after a donor confirms a recipient. Locations shown publicly are approximate."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Area</p>
                <p className="font-semibold">{d.pickupAreaLabel}{d.pickupCity ? `, ${d.pickupCity}` : ""}</p>
              </div>
              {d.pickupAddress ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Exact address</p>
                  <p className="font-semibold">{d.pickupAddress}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Exact address</p>
                  <p className="text-sm text-muted">Shared after confirmation</p>
                </div>
              )}
              <div><p className="text-xs uppercase tracking-wider text-muted">Pickup window</p><p className="font-semibold">{formatDateTime(d.availableFrom)} – {formatDateTime(d.availableUntil)}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-muted">Latest pickup</p><p className="font-semibold">{formatDateTime(d.pickupDeadline)}</p></div>
              {d.handlingInstructions ? <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wider text-muted">Handover instructions</p><p>{d.handlingInstructions}</p></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle as="h2">Progress</CardTitle><CardDescription>Every status change is recorded with its time and who made it.</CardDescription></CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l-2 border-sage pl-6">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-forest" aria-hidden><CheckCircle2 className="size-3 text-white" /></span>
                    <p className="font-semibold text-deep">{h.toStatus ? DONATION_STATUS_LABELS[h.toStatus as DonationStatus] : h.action.replaceAll("_", " ").toLowerCase()}</p>
                    <p className="text-xs text-muted">{formatDateTime(h.createdAt)}{h.actorRole ? ` · by ${h.actorRole.toLowerCase()}` : " · by the system"}</p>
                    {h.note ? <p className="mt-1 text-sm text-ink/80">{h.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <DonationActions
            donation={d}
            role={user.role === "ADMIN" ? "ADMIN" : user.role}
            viewerId={user.id}
            viewerVerified={user.verificationStatus === "VERIFIED"}
            isOwner={isOwner}
            isClaimant={isClaimant}
          />

          <Card>
            <CardHeader><CardTitle as="h2">Donor</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-deep"><Store className="size-4 text-forest" aria-hidden /> {d.donor.name}{d.donor.verified ? <Badge tone="sage">Verified</Badge> : null}</p>
              {d.donor.type ? <p className="text-muted">{ORG_TYPE_LABELS[d.donor.type as keyof typeof ORG_TYPE_LABELS] ?? d.donor.type}</p> : null}
              {d.donor.phone ? <p className="flex items-center gap-2"><Phone className="size-4 text-forest" aria-hidden /> <a className="font-medium text-forest hover:underline" href={`tel:${d.donor.phone}`}>{d.donor.phone}</a></p> : <p className="text-xs text-muted">Contact details are shared with confirmed partners.</p>}
            </CardContent>
          </Card>

          {d.claimant ? (
            <Card>
              <CardHeader><CardTitle as="h2">Recipient</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold text-deep">{d.claimant.name}</p>
                {d.claimant.type ? <p className="text-muted">{ORG_TYPE_LABELS[d.claimant.type as keyof typeof ORG_TYPE_LABELS] ?? d.claimant.type}</p> : null}
                {d.claimant.receivingWindow ? <p className="flex items-center gap-2 text-muted"><Clock className="size-4" aria-hidden /> Receiving {d.claimant.receivingWindow}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {d.status === "DRAFT" && isOwner ? (
            <Alert tone="info"><span className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /> This is a draft. Only you can see it until you publish.</span></Alert>
          ) : null}
          <p className="flex items-start gap-2 text-xs text-muted"><CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> LastPlate records who did what and when. It does not judge whether food is safe to eat. Check food before you serve or transport it.</p>
        </div>
      </div>
    </div>
  );
}
