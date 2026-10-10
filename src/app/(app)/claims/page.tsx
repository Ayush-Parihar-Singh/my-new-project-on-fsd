import Link from "next/link";
import { HandHeart } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { listRecipientClaims } from "@/server/services/claim.service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/donations/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Claims" };
export const dynamic = "force-dynamic";

const GROUPS: { title: string; statuses: DonationStatus[]; hint: string }[] = [
  { title: "Pending requests", statuses: ["REQUESTED"], hint: "Waiting for the donor to confirm." },
  { title: "Confirmed collections", statuses: ["CONFIRMED", "PICKUP_IN_PROGRESS"], hint: "Show the handover code to the volunteer when they arrive." },
  { title: "Past collections", statuses: ["COMPLETED", "FAILED_HANDOVER", "CANCELLED"], hint: "Completed and closed handovers." },
];

export default async function ClaimsPage() {
  const user = await requirePageUser(["NGO"]);
  const claims = await listRecipientClaims(user);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipient"
        title="My claims"
        description="Food your organization has requested, confirmed and collected."
        actions={<ButtonLink href="/discover" variant="secondary">Find more food</ButtonLink>}
      />
      {claims.length === 0 ? (
        <EmptyState icon={<HandHeart />} title="No claims yet" action={<ButtonLink href="/discover">Find food near me</ButtonLink>}>
          When you request food from the discovery map, it shows here until the handover is complete.
        </EmptyState>
      ) : (
        GROUPS.map((g) => {
          const items = claims.filter((c) => g.statuses.includes(c.status as DonationStatus));
          if (!items.length) return null;
          return (
            <section key={g.title} aria-labelledby={`group-${g.title}`} className="space-y-3">
              <div>
                <h2 id={`group-${g.title}`} className="font-display text-lg font-bold text-deep">{g.title} <span className="text-sm font-normal text-muted">({items.length})</span></h2>
                <p className="text-sm text-muted">{g.hint}</p>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {items.map((c) => (
                  <li key={c.id}>
                    <Card className="h-full transition-shadow hover:shadow-lift">
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-forest">{c.category ? FOOD_CATEGORY_LABELS[c.category as keyof typeof FOOD_CATEGORY_LABELS] : "Food"}</p>
                            <Link href={`/donations/${c.id}`} className="font-display text-lg font-bold text-deep hover:underline">{c.title}</Link>
                          </div>
                          <StatusBadge status={c.status as DonationStatus} />
                        </div>
                        <p className="text-sm text-ink/80">{c.quantity} {c.unit ? UNIT_LABELS[c.unit as keyof typeof UNIT_LABELS] : ""} · {c.pickupAreaLabel}</p>
                        <p className="text-xs text-muted">Donor: {c.donor.name}{c.pickupDeadline ? ` · Pickup by ${formatDateTime(c.pickupDeadline)}` : ""}</p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
