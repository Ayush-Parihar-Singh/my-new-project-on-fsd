"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/client/api";
import { formatDateTime, relativeTime, cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationList({ items, unread, page, totalPages }: { items: NotificationItem[]; unread: number; page: number; totalPages: number }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function markOne(id: string) {
    const res = await api("POST", `/api/notifications/${id}/read`);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  async function markAll() {
    setBusy(true);
    const res = await api("POST", "/api/notifications/read-all");
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{unread > 0 ? `${unread} unread` : "You are all caught up"}</p>
        <Button variant="outline" size="sm" onClick={markAll} loading={busy} disabled={unread === 0}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="No notifications yet">Updates about claims, pickups, deadlines and verification appear here.</EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={cn("flex gap-4 px-5 py-4", !n.read && "bg-forest-50/50")}>
                <span className="mt-1 shrink-0">
                  {n.read ? <span className="block size-2.5 rounded-full bg-line" aria-hidden /> : <CircleDot className="size-3.5 text-coral" aria-label="Unread" />}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn("text-sm", n.read ? "font-medium text-ink/80" : "font-semibold text-deep")}>{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="text-xs text-muted"><time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time> · {relativeTime(n.createdAt)}</p>
                  <div className="flex gap-3 pt-1 text-sm">
                    {n.link ? <Link href={n.link} className="font-semibold text-forest hover:underline" onClick={() => !n.read && markOne(n.id)}>Open</Link> : null}
                    {!n.read ? <button type="button" className="font-medium text-muted hover:text-deep" onClick={() => markOne(n.id)}>Mark as read</button> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/notifications?page=${page - 1}`}>Previous</Link> : null}
            {page < totalPages ? <Link className="rounded-full border px-4 py-2 font-semibold hover:bg-white" href={`/notifications?page=${page + 1}`}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
