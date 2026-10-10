import Link from "next/link";
import { z } from "zod";
import { Users } from "lucide-react";
import { requirePageUser } from "@/server/auth/guards";
import { listUsers } from "@/server/services/admin.service";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { UserStatusToggle } from "@/components/admin/user-status-toggle";
import { ROLE_LABELS, VERIFICATION_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const query = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["DONOR", "NGO", "VOLUNTEER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageUser(["ADMIN"]);
  const q = query.parse(await searchParams);
  const data = await listUsers(actor, { q: q.q || undefined, role: q.role, page: q.page, pageSize: 20 });
  const qs = (p: number) => new URLSearchParams({ ...(q.q ? { q: q.q } : {}), ...(q.role ? { role: q.role } : {}), page: String(p) }).toString();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration" title="Users" description="Search accounts and suspend or reactivate them. Every change needs a reason and is recorded in the audit log." />
      <form className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end" role="search">
        <Field id="q" label="Search by name or email">
          <Input id="q" name="q" defaultValue={q.q ?? ""} placeholder="e.g. spice route" />
        </Field>
        <Field id="role" label="Role">
          <Select id="role" name="role" defaultValue={q.role ?? ""} className="md:w-44">
            <option value="">All roles</option>
            {(["DONOR", "NGO", "VOLUNTEER", "ADMIN"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>
      {data.items.length === 0 ? (
        <EmptyState icon={<Users />} title="No users match">Try a different search or role.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">User accounts</caption>
            <thead className="border-b border-line bg-cream text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                <th scope="col" className="px-5 py-3 font-semibold">Verification</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last sign-in</th>
                <th scope="col" className="px-5 py-3 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-deep">{u.organization?.name ?? u.fullName}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                    {u.isDemo ? <Badge tone="demo" className="mt-1">Demo</Badge> : null}
                  </td>
                  <td className="px-5 py-4">{ROLE_LABELS[u.role]}</td>
                  <td className="px-5 py-4">{VERIFICATION_LABELS[u.verificationStatus]}{u.status === "SUSPENDED" ? <Badge tone="danger" className="ml-2">Suspended</Badge> : null}</td>
                  <td className="px-5 py-4 text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                  <td className="px-5 py-4">
                    {u.role !== "ADMIN" || u.id !== actor.id ? (
                      <UserStatusToggle userId={u.id} name={u.organization?.name ?? u.fullName} status={u.status as "ACTIVE" | "SUSPENDED"} />
                    ) : (
                      <span className="text-xs text-muted">That is you</span>
                    )}
                  </td>
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
            {data.page > 1 ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/admin/users?${qs(data.page - 1)}`}>Previous</Link> : null}
            {data.page < data.totalPages ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/admin/users?${qs(data.page + 1)}`}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
