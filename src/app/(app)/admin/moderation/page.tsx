import { Flag, ShieldAlert } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { listModerationQueue } from "@/server/services/admin.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ModerationAction } from "@/components/admin/moderation-actions";
import { StatusBadge } from "@/components/donations/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const user = await requirePageUser(["ADMIN"]);
  const q = await listModerationQueue(user);
  const empty = q.duplicates.length === 0 && q.reports.length === 0;
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Administration" title="Moderation" description="Possible reposts and reports from recipients and volunteers. Decisions are recorded in the audit log with your note." />
      {empty ? <EmptyState icon={<ShieldAlert />} title="The queue is clear">Flagged duplicates and open reports appear here.</EmptyState> : null}

      {q.reports.length ? (
        <section aria-labelledby="reports-heading" className="space-y-4">
          <h2 id="reports-heading" className="font-display text-xl font-bold text-deep">Open reports <span className="text-sm font-normal text-muted">({q.reports.length})</span></h2>
          <ul className="space-y-3">
            {q.reports.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Flag className="size-4 text-coral-ink" aria-hidden />
                        <CardTitle as="h3">{r.donation.title}</CardTitle>
                        <StatusBadge status={r.donation.status as DonationStatus} />
                      </div>
                      <p className="text-sm text-ink/80">{r.reason}</p>
                      <p className="text-xs text-muted">Donor: {r.donation.donor} · Reported {formatDateTime(r.createdAt)}</p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 lg:w-80 lg:justify-end">
                      <ModerationAction targetId={r.id} action="DISMISS_REPORT" label="Dismiss" needsReason reasonHint="Why the report does not need action" />
                      <ModerationAction targetId={r.id} action="RESOLVE_REPORT" label="Mark resolved" variant="primary" needsReason reasonHint="What was done" />
                      {r.donation.status === "AVAILABLE" ? (
                        <ModerationAction targetId={r.donation.id} action="REJECT_LISTING" label="Remove listing" variant="danger" needsReason reasonHint="Shown to the donor" />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q.duplicates.length ? (
        <section aria-labelledby="dups-heading" className="space-y-4">
          <h2 id="dups-heading" className="font-display text-xl font-bold text-deep">Possible duplicates <span className="text-sm font-normal text-muted">({q.duplicates.length})</span></h2>
          <p className="text-sm text-muted">Flagged by similarity to the same donor's recent listings. A flag is a prompt to check, not proof of a repost.</p>
          <ul className="space-y-3">
            {q.duplicates.map((d) => (
              <li key={d.id}>
                <Card>
                  <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle as="h3">{d.title}</CardTitle>
                        <StatusBadge status={d.status as DonationStatus} />
                        {d.duplicateScore != null ? <Badge tone="amber">Similarity {Math.round(d.duplicateScore * 100)}%</Badge> : null}
                      </div>
                      <p className="text-xs text-muted">{d.donor} · Published {d.publishedAt ? formatDateTime(d.publishedAt) : "n/a"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <ModerationAction targetId={d.id} action="DISMISS_DUPLICATE_FLAG" label="Not a duplicate" needsReason reasonHint="Why this is a new listing" />
                      <ModerationAction targetId={d.id} action="REJECT_LISTING" label="Remove as repost" variant="danger" needsReason reasonHint="Shown to the donor" />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q.rejected.length ? (
        <section aria-labelledby="rejected-heading" className="space-y-3">
          <h2 id="rejected-heading" className="font-display text-lg font-bold text-deep">Recently removed</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {q.rejected.map((r) => (
              <li key={r.id} className="px-5 py-3 text-sm">
                <span className="font-semibold text-deep">{r.title}</span> <span className="text-muted">· {r.reason ?? "No reason recorded"} · {r.rejectedAt ? formatDateTime(r.rejectedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
