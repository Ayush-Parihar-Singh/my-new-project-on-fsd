import Link from "next/link";
import { AlertTriangle, Flag, ShieldCheck, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { adminOverview } from "@/server/services/analytics.service";
import { formatNumber, formatDateTime } from "@/lib/utils";
import { UNIT_LABELS } from "@/lib/constants";

export async function AdminOverview() {
  const o = await adminOverview(30);
  const d = o.donations;
  const q = o.queues;
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Administration" title="Operations overview" description="Live counts from the database. Demo records are counted separately and labelled." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active donations" value={formatNumber(d.active)} hint="Available through in progress" icon={<Users />} tone="sage" />
        <StatCard label="Completed handovers" value={formatNumber(d.completedHandovers)} hint={`Last ${o.days} days of activity`} icon={<ShieldCheck />} tone="forest" />
        <StatCard label="Failed pickups" value={formatNumber(d.failedPickups)} hint={d.pickupSuccessRate != null ? `Success rate ${d.pickupSuccessRate}%` : "No closed handovers yet"} icon={<AlertTriangle />} tone="coral" />
        <StatCard label="Moderation queue" value={formatNumber(q.flaggedDuplicates + q.openReports)} hint={`${q.flaggedDuplicates} duplicates · ${q.openReports} reports`} icon={<Flag />} tone="cream" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Published and completed, last 14 days</CardTitle>
            <CardDescription>All organizations, counted from the database.</CardDescription>
          </CardHeader>
          <CardContent><TrendChart data={o.dailyTrend} label="Platform daily published and completed donations" /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Category trends</CardTitle>
            <CardDescription>Listings in the last {o.days} days.</CardDescription>
          </CardHeader>
          <CardContent>
            {o.categoryTrend.length === 0 ? <p className="text-sm text-muted">No listings in this window yet.</p> : <CategoryChart data={o.categoryTrend} />}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle as="h2">Verification queue</CardTitle><CardDescription>{formatNumber(q.pendingVerifications)} waiting</CardDescription></CardHeader>
          <CardContent><Link href="/admin/verifications" className="text-sm font-semibold text-forest hover:underline">Review requests →</Link></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle as="h2">Moderation</CardTitle><CardDescription>{formatNumber(q.flaggedDuplicates)} duplicate flags · {formatNumber(q.openReports)} open reports</CardDescription></CardHeader>
          <CardContent><Link href="/admin/moderation" className="text-sm font-semibold text-forest hover:underline">Open moderation queue →</Link></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle as="h2">Quantities handed over</CardTitle><CardDescription>Completed handovers by unit</CardDescription></CardHeader>
          <CardContent>
            {o.quantities.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="space-y-1 text-sm">
                {o.quantities.map((x) => <li key={x.unit} className="flex justify-between"><span className="text-muted">{UNIT_LABELS[x.unit as keyof typeof UNIT_LABELS] ?? x.unit}</span><span className="font-semibold tabular-nums">{formatNumber(x.quantity)}</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle as="h2">Recent audit entries</CardTitle><CardDescription>Latest administrative and system actions.</CardDescription></CardHeader>
        <CardContent>
          {o.recentAudit.length === 0 ? <p className="text-sm text-muted">No audit entries yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {o.recentAudit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <span className="font-medium text-deep">{a.action}</span>
                  <span className="text-muted">{a.actorEmail ?? "system"} · {formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/audit" className="mt-3 inline-block text-sm font-semibold text-forest hover:underline">Full audit log →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
