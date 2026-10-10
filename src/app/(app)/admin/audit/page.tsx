import Link from "next/link";
import { z } from "zod";
import { ScrollText } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { listAudit } from "@/server/services/admin.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const query = z.object({
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(["ADMIN"]);
  const q = query.parse(await searchParams);
  const data = await listAudit({ action: q.action || undefined, page: q.page, pageSize: 25 });
  const pageHref = (p: number) => `/admin/audit?${new URLSearchParams({ ...(q.action ? { action: q.action } : {}), page: String(p) })}`;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration" title="Audit log" description="Every admin decision, with who made it, when, and from which address. Entries are never edited." />
      <form className="flex flex-col gap-4 md:flex-row md:items-end" role="search">
        <Field id="action" label="Action starts with" hint="For example: verification, moderation, user">
          <Input id="action" name="action" defaultValue={q.action ?? ""} className="md:w-72" />
        </Field>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {data.items.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No entries">Admin actions appear here as they happen.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead className="border-b border-line bg-cream text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">When</th>
                <th scope="col" className="px-5 py-3">Action</th>
                <th scope="col" className="px-5 py-3">Target</th>
                <th scope="col" className="px-5 py-3">By</th>
                <th scope="col" className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDateTime(a.createdAt)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-deep">{a.action}</td>
                  <td className="px-5 py-3 text-xs text-ink/80">{a.entityType}<span className="block font-mono text-[11px] text-muted">{a.entityId}</span></td>
                  <td className="px-5 py-3 text-xs text-ink/80">{a.actorEmail ?? "system"}{a.ip ? <span className="block text-muted">{a.ip}</span> : null}</td>
                  <td className="max-w-xs px-5 py-3 text-xs text-muted">{a.metadata ? <code className="line-clamp-3 break-all">{JSON.stringify(a.metadata)}</code> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data.totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            {data.page > 1 ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={pageHref(data.page - 1)}>Newer</Link> : null}
            {data.page < data.totalPages ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={pageHref(data.page + 1)}>Older</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
