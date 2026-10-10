import { z } from "zod";
import { requirePageUser } from "@/server/auth/guards";
import { listMyNotifications } from "@/server/services/notification.service";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const query = z.object({ page: z.coerce.number().int().min(1).catch(1) });

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { page } = query.parse(await searchParams);
  const data = await listMyNotifications(user.id, page, 20, false);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Inbox" title="Notifications" description="Claims, pickups, deadlines, cancellations and completed handovers. Email is sent too when your organization has it enabled." />
      <NotificationList items={data.items} unread={data.unread} page={data.page} totalPages={data.totalPages} />
    </div>
  );
}
