import { Suspense } from "react";
import { z } from "zod";
import { Sparkles, Info } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { adminOverview } from "@/server/services/analytics.service";
import { generateInsights } from "@/server/services/ai.service";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { formatNumber, cn } from "@/lib/utils";
import { DONATION_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { Users, PackageCheck, Clock, Scale } from "lucide-react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;
const query = z.object({ days: z.coerce.number().refine((d) => (RANGES as readonly number[]).includes(d), "Range").catch(30) });

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(["ADMIN"]);
  const { days } = query.parse(await searchParams);
  const o = await adminOverview(days);
  const d = o.donations;
  const statusRows = Object.entries(d.byStatus) as [keyof typeof DONATION_STATUS_LABELS, number][];
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Administration"
        title="Analytics"
        description="Counted live from the database at request time. Demo records are included in the totals and labelled separately."
        actions={
          <nav aria-label="Time range" className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-line">
            {RANGES.map((r) => (
              <a key={r} href={`/admin/analytics?days=${r}`} aria-current={o.days === r ? "page" : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", o.days === r ? "bg-forest text-white" : "text-ink/75 hover:text-deep")}>
                {r} days
              </a>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Verified organizations" value={formatNumber(o.users.verifiedOrganizations)} hint={`${formatNumber(o.users.total)} accounts in total`} icon={<Users />} tone="sage" />
        <StatCard label="Completed handovers" value={formatNumber(d.completedHandovers)} hint="All time" icon={<PackageCheck />} tone="forest" />
        <StatCard label="Pickup success" value={d.pickupSuccessRate != null ? `${d.pickupSuccessRate}%` : "—"} hint="Completed ÷ closed handovers" icon={<Scale />} tone="cream" />
        <StatCard label="Median time to claim" value={d.medianMinutesToClaim != null ? `${Math.round(d.medianMinutesToClaim)} min` : "—"} hint="From posting to first request" icon={<Clock />} tone="coral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Listings published and completed</CardTitle>
            <CardDescription>Last 14 days, all organizations</CardDescription>
          </CardHeader>
          <CardContent><TrendChart data={o.dailyTrend} label="Published and completed per day" /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Categories</CardTitle>
            <CardDescription>Listings posted in the last {o.days} days</CardDescription>
          </CardHeader>
          <CardContent>{o.categoryTrend.length ? <CategoryChart data={o.categoryTrend} /> : <p className="text-sm text-muted">No listings in this range yet.</p>}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle as="h2">Donations by status</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y divide-line">
              {statusRows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="text-ink/80">{DONATION_STATUS_LABELS[k]}</dt>
                  <dd className="font-semibold tabular-nums text-deep">{formatNumber(v)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle as="h2">Accounts by role</CardTitle><CardDescription>{formatNumber(o.demo.totalUsers)} accounts · {formatNumber(o.demo.users)} demo</CardDescription></CardHeader>
          <CardContent>
            <dl className="divide-y divide-line">
              {Object.entries(o.users.byRole).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="text-ink/80">{ROLE_LABELS[k as keyof typeof ROLE_LABELS] ?? k}</dt>
                  <dd className="font-semibold tabular-nums text-deep">{formatNumber(v)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Demo: {formatNumber(o.demo.donations)} of {formatNumber(o.demo.totalDonations)} donations are fictional seed data.</p>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="insights-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-forest" aria-hidden />
          <h2 id="insights-heading" className="font-display text-xl font-bold text-deep">Impact insights</h2>
        </div>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Insights />
        </Suspense>
      </section>
    </div>
  );
}

async function Insights() {
  const r = await generateInsights();
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={r.source === "AI" ? "forest" : "neutral"}>{r.source === "AI" ? "AI summary" : "Rule-based summary"}</Badge>
          <span className="text-xs text-muted">Built from aggregate counts only. No personal data is sent.</span>
        </div>
        <p className="leading-relaxed text-ink/85">{r.summary}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink/85">
          {r.suggestions.map((s) => <li key={s}>{s}</li>)}
        </ul>
        {r.source !== "AI" ? <Alert tone="info">AI summaries are off in this environment, so the summary follows fixed rules over the same numbers.</Alert> : null}
      </CardContent>
    </Card>
  );
}
