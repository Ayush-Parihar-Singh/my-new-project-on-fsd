// In-app notifications, outbound email records and audit log persistence.
import type { Prisma } from "@/generated/prisma/client";
import type { EmailStatus, NotificationType } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

export async function createNotifications(client: Tx | typeof db, items: NotificationInput[]): Promise<void> {
  if (items.length === 0) return;
  await client.notification.createMany({
    data: items.map((i) => ({ userId: i.userId, type: i.type, title: i.title.slice(0, 160), body: i.body.slice(0, 600), link: i.link ?? null })),
  });
}

export async function listNotifications(userId: string, skip: number, take: number, unreadOnly: boolean) {
  const where: Prisma.NotificationWhereInput = { userId, ...(unreadOnly ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, total, unread };
}

export const countUnread = (userId: string) => db.notification.count({ where: { userId, readAt: null } });

export const markNotificationRead = (userId: string, id: string) =>
  db.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });

export const markAllNotificationsRead = (userId: string) =>
  db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });

export const findUserContact = (userId: string) =>
  db.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, status: true } });

export async function recordOutboundEmail(data: {
  toEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  error?: string | null;
}): Promise<void> {
  await db.outboundEmail.create({
    data: {
      toEmail: data.toEmail,
      subject: data.subject.slice(0, 200),
      body: data.body,
      status: data.status,
      error: data.error?.slice(0, 300) ?? null,
      sentAt: data.status === "SENT" ? new Date() : null,
    },
  });
}

export async function writeAudit(
  client: Tx | typeof db,
  entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? undefined,
      ip: entry.ip ?? null,
    },
  });
}

export async function listAuditLogs(args: { action?: string; skip: number; take: number }) {
  const where: Prisma.AuditLogWhereInput = args.action ? { action: { startsWith: args.action } } : {};
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: args.skip, take: args.take }),
    db.auditLog.count({ where }),
  ]);
  return { items, total };
}
