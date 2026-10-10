import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { z } from "zod";
import { requirePageUser } from "@/server/auth/guards";
import { listVerifications } from "@/server/services/admin.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { VerificationDecision } from "@/components/admin/verification-decision";
import { ORG_TYPE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime, cn } from "@/lib/utils";

export const metadata = { title: "Verifications" };
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const query = z.object({
  status: z.enum(STATUSES).catch("PENDING"),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(["ADMIN"]);
  const q = query.parse(await searchParams);
  const data = await listVerifications(q.status, q.page, 15);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration" title="Verification queue" description="Check each organization before it can publish or claim food. Approvals and rejections are recorded in the audit log." />
      <nav aria-label="Filter by status" className="flex gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/verifications?status=${s}`} aria-current={q.status === s ? "page" : undefined} className={cn("rounded-full px-4 py-2 text-sm font-semibold", q.status === s ? "bg-forest text-white" : "bg-white text-ink/80 ring-1 ring-line hover:text-deep")}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </nav>
      {data.items.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title="Nothing waiting here">New organization requests will appear in this queue.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {data.items.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-deep">{r.user.organization?.name ?? r.user.fullName}</h2>
                      <Badge tone="neutral">{ROLE_LABELS[r.user.role]}</Badge>
                      {r.user.organization ? <Badge tone="sage">{ORG_TYPE_LABELS[r.user.organization.type as keyof typeof ORG_TYPE_LABELS] ?? r.user.organization.type}</Badge> : null}
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs uppercase tracking-wider text-muted">Applicant</dt><dd>{r.user.fullName} · {r.user.email}</dd></div>
                      <div><dt className="text-xs uppercase tracking-wider text-muted">Submitted</dt><dd>{formatDateTime(r.submittedAt)}</dd></div>
                      {r.user.organization ? <div><dt className="text-xs uppercase tracking-wider text-muted">Address</dt><dd>{r.user.organization.addressLine}, {r.user.organization.city}</dd></div> : null}
                      {r.user.organization?.registrationNumber ? <div><dt className="text-xs uppercase tracking-wider text-muted">Registration</dt><dd>{r.user.organization.registrationNumber}</dd></div> : null}
                    </dl>
                    {r.applicantNote ? <p className="rounded-xl bg-cream p-3 text-sm text-ink/80"><span className="font-semibold">Note from applicant: </span>{r.applicantNote}</p> : null}
                    {r.reviewNote ? <p className="text-sm text-muted"><span className="font-semibold">Review note: </span>{r.reviewNote}</p> : null}
                  </div>
                  {q.status === "PENDING" ? (
                    <div className="w-full lg:w-72">
                      <VerificationDecision requestId={r.id} orgName={r.user.organization?.name ?? r.user.fullName} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data.totalPages > 1 ? <p className="text-sm text-muted">Page {data.page} of {data.totalPages}</p> : null}
    </div>
  );
}
