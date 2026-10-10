import Link from "next/link";
import { z } from "zod";
import { PackageOpen, PlusCircle } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { listOwnDonations } from "@/server/services/donation.service";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/donations/status-badge";
import { Card } from "@/components/ui/card";
import { DONATION_STATUS_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export const metadata = { title: "My donations" };
export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED", "FAILED_HANDOVER"] as const;
const filterSchema = z.object({ status: z.enum(STATUSES).optional(), page: z.coerce.number().int().min(1).catch(1) });

export default async function MyDonationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser(["DONOR"]);
  const parsed = filterSchema.parse(await searchParams);
  const data = await listOwnDonations(user, { status: parsed.status, page: parsed.page, pageSize: 10 });
  const tabs: (typeof STATUSES[number] | undefined)[] = [undefined, "DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"];
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Donations"
        title="My donations"
        description="Drafts, live listings and past handovers. Open any donation to edit, claim, confirm or cancel."
        actions={<ButtonLink href="/donations/new" className="bg-coral text-deep hover:bg-[#dd7860]"><PlusCircle /> Post a donation</ButtonLink>}
      />
      <nav aria-label="Filter by status" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const active = parsed.status === t || (!t && !parsed.status);
          return (
            <Link
              key={t ?? "all"}
              href={t ? `/donations?status=${t}` : "/donations"}
              aria-current={active ? "page" : undefined}
              className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", active ? "bg-forest text-white" : "bg-white text-ink/80 ring-1 ring-line hover:text-deep")}
            >
              {t ? DONATION_STATUS_LABELS[t] : "All"}
            </Link>
          );
        })}
      </nav>
      {data.items.length === 0 ? (
        <EmptyState icon={<PackageOpen />} title="Nothing here yet" action={<ButtonLink href="/donations/new">Post a donation</ButtonLink>}>
          Donations you post, including drafts, appear in this list.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-line bg-cream px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
            <span>Donation</span><span>Quantity</span><span>Deadline</span><span>Status</span>
          </div>
          <ul className="divide-y divide-line">
            {data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/donations/${d.id}`} className="grid gap-2 px-5 py-4 hover:bg-forest-50/60 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center md:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-deep">{d.title}</span>
                    <span className="block text-xs text-muted">Updated {formatDateTime(d.updatedAt)}</span>
                  </span>
                  <span className="text-sm">{d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""}</span>
                  <span className="text-sm text-muted">{d.pickupDeadline ? formatDateTime(d.pickupDeadline) : "—"}</span>
                  <span><StatusBadge status={d.status as DonationStatus} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            {data.page > 1 ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/donations?${new URLSearchParams({ ...(parsed.status ? { status: parsed.status } : {}), page: String(data.page - 1) })}`}>Previous</Link> : null}
            {data.page < data.totalPages ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/donations?${new URLSearchParams({ ...(parsed.status ? { status: parsed.status } : {}), page: String(data.page + 1) })}`}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
