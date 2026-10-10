// In-app notifications plus optional email. Notifications are written inside the same
// transaction as the state change they describe, so users never see a notification for a
// change that was rolled back.
import type { NotificationType } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { sendEmail } from "../integrations/email";
import * as repo from "../repositories/notifications.repo";

export type { NotificationInput } from "../repositories/notifications.repo";
import type { NotificationInput } from "../repositories/notifications.repo";

const EMAILABLE: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "CLAIM_RECEIVED",
  "CLAIM_CONFIRMED",
  "ASSIGNMENT_ACCEPTED",
  "DONATION_CANCELLED",
  "DONATION_EXPIRED",
  "HANDOVER_COMPLETED",
  "HANDOVER_FAILED",
  "VERIFICATION_UPDATE",
  "LISTING_MODERATED",
  "DEADLINE_REMINDER",
]);

export interface PendingEmail {
  userId: string;
  subject: string;
  body: string;
}

/** Writes notifications in the caller's transaction and returns the emails to send after commit. */
export async function notifyUsers(client: Tx | typeof db, items: NotificationInput[]): Promise<PendingEmail[]> {
  await repo.createNotifications(client, items);
  return items
    .filter((i) => EMAILABLE.has(i.type))
    .map((i) => ({
      userId: i.userId,
      subject: `LastPlate: ${i.title}`,
      body: `${i.body}${i.link ? `\n\nOpen LastPlate: ${process.env.APP_URL ?? "http://localhost:3000"}${i.link}` : ""}`,
    }));
}

/** Sends emails after the transaction commits. Failures are recorded, never thrown to the user. */
export async function dispatchEmails(pending: PendingEmail[]): Promise<void> {
  await Promise.allSettled(
    pending.map(async (p) => {
      const user = await repo.findUserContact(p.userId);
      if (!user || user.status !== "ACTIVE") return;
      await sendEmail({ to: user.email, subject: p.subject, text: `Hello ${user.fullName},\n\n${p.body}\n\n— The LastPlate team` });
    }),
  );
}

export async function listMyNotifications(userId: string, page: number, pageSize: number, unreadOnly: boolean) {
  const { items, total, unread } = await repo.listNotifications(userId, (page - 1) * pageSize, pageSize, unreadOnly);
  return {
    unread,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function unreadCount(userId: string): Promise<number> {
  return repo.countUnread(userId);
}

export async function markRead(userId: string, id: string): Promise<void> {
  const res = await repo.markNotificationRead(userId, id);
  if (res.count === 0) throw new NotFoundError("That notification was not found.");
}

export async function markAllRead(userId: string): Promise<void> {
  await repo.markAllNotificationsRead(userId);
}
