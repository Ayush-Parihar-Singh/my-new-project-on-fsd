import Link from "next/link";
import { Activity, CheckCircle2, Clock, HandPlatter, PackageOpen, PlusCircle, Hourglass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle, PageHeader } from "@/components/ui/page-header";
import { TrendChart } from "@/components/charts/trend-chart";
import { StatusBadge } from "@/components/donations/status-badge";
import { donorDashboardData } from "@/server/services/analytics.service";
import { listOwnDonations } from "@/server/services/donation.service";
import type { AuthUser } from "@/server/auth/session";
import { DONATION_STATUS_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime, formatNumber, greeting, relativeTime } from "@/lib/utils";
import type { DonationStatus } from "@/generated/prisma/enums";

export async function DonorDashboard({ user }: { user: AuthUser }) {
  const [data, recent] = await Promise.all([donorDashboardData(user.id), listOwnDonations(user, { page: 1, pageSize: 6 })]);
  const c = data.counts;
  const isVerified = user.verificationStatus === "VERIFIED";
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Donor dashboard"
        title={`${greeting()}! Let’s make today’s surplus count.`}
        description={isVerified ? "Post what is left, see who claimed it and follow every handover." : "Your organization is awaiting verification. You can prepare listings as drafts in the meantime."}
        actions={
          <ButtonLink href="/donations/new" size="lg" className="bg-coral text-deep hover:bg-[#dd7860]">
            <PlusCircle /> Post a Donation
          </ButtonLink>
        }
      />

      {!isVerified ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-2 py-5 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
            <p><span className="font-semibold">Verification needed to publish.</span> An admin reviews organization details before listings go live.</p>
            <Link href="/profile" className="font-semibold text-forest underline-offset-2 hover:underline">Complete your organization profile</Link>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="donor-stats" className="space-y-4">
        <h2 id="donor-stats" className="sr-only">Donation summary</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Active listings" value={formatNumber(c.active)} hint="Visible to verified recipients" icon={<PackageOpen />} tone="sage" />
          <StatCard label="Pending requests" value={formatNumber(c.pendingRequests)} hint="Waiting for your confirmation" icon={<Hourglass />} tone="coral" />
          <StatCard label="Confirmed pickups" value={formatNumber(c.confirmedPickups)} hint="Arranged and on the way" icon={<Clock />} tone="cream" />
          <StatCard label="Completed" value={formatNumber(c.completed)} hint="Handed over and recorded" icon={<CheckCircle2 />} tone="forest" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Published and completed, last 14 days</CardTitle>
            <CardDescription>Counts from your listings in the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={data.trend} label="Daily published and completed donations" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Food handed over</CardTitle>
            <CardDescription>Completed handovers by unit.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.completedQuantities.length === 0 ? (
              <p className="text-sm text-muted">No completed handovers yet. Your first one will appear here.</p>
            ) : (
              <ul className="space-y-3">
                {data.completedQuantities.map((q) => (
                  <li key={q.unit} className="flex items-baseline justify-between rounded-xl bg-sage-light px-4 py-3">
                    <span className="text-sm text-muted">{UNIT_LABELS[q.unit as keyof typeof UNIT_LABELS] ?? q.unit}</span>
                    <span className="font-display text-2xl font-extrabold text-deep tabular-nums">{formatNumber(q.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="recent-listings">
          <SectionTitle id="recent-listings" action={<Link href="/donations" className="text-sm font-semibold text-forest hover:underline">View all</Link>}>Recent listings</SectionTitle>
          {recent.items.length === 0 ? (
            <EmptyState icon={<HandPlatter />} title="No donations yet" action={<ButtonLink href="/donations/new">Post your first donation</ButtonLink>}>
              Share a batch of surplus food. It takes about five minutes.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              {recent.items.map((d) => (
                <li key={d.id}>
                  <Link href={`/donations/${d.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-forest-50/60">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-deep">{d.title}</p>
                      <p className="text-xs text-muted">{d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""} · {d.pickupDeadline ? `deadline ${relativeTime(d.pickupDeadline)}` : "no deadline"}</p>
                    </div>
                    <StatusBadge status={d.status as DonationStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activity">
          <SectionTitle id="activity">Activity</SectionTitle>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon={<Activity />} title="No activity yet">Status changes on your listings appear here.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {data.recentActivity.slice(0, 8).map((a) => (
                <li key={a.id} className="flex gap-3 rounded-xl border border-line bg-white p-3.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-forest" aria-hidden />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-deep">{a.donationTitle}</p>
                    <p className="text-muted">{a.toStatus ? DONATION_STATUS_LABELS[a.toStatus as DonationStatus] : a.action} · {formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
