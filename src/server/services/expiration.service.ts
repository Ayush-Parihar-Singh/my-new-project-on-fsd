// Time-driven lifecycle rules: listings expire, unfinished handovers fail, and deadlines are announced.
// Runs from the scheduled worker (scripts/expiration-worker.ts / POST /api/cron/expire) and,
// throttled, opportunistically on read paths so the app stays correct without a scheduler.
import type { DonationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { transitionDonation } from "../repositories/donations.repo";
import { notifyUsers, dispatchEmails } from "./notification.service";
import { writeAudit } from "../repositories/notifications.repo";

export interface SweepResult {
  expired: number;
  failedHandovers: number;
  reminders: number;
  errors: number;
}

const REMINDER_WINDOW_MS = 2 * 3600_000;

export async function runExpirationSweep(now = new Date()): Promise<SweepResult> {
  const result: SweepResult = { expired: 0, failedHandovers: 0, reminders: 0, errors: 0 };

  // 1) Unclaimed or unconfirmed listings past their deadline -> EXPIRED.
  const stale = await db.donation.findMany({
    where: { status: { in: ["AVAILABLE", "REQUESTED"] }, pickupDeadline: { lt: now } },
    select: { id: true, title: true, donorId: true, claimedById: true, status: true },
    take: 200,
  });
  for (const d of stale) {
    try {
      const emails = await db.$transaction(async (tx) => {
        await transitionDonation(tx, d.id, "EXPIRED", {
          action: "EXPIRED",
          note: "Pickup deadline passed before the donation was collected.",
          expectedFrom: [d.status as DonationStatus],
          data: { expiredAt: now },
        });
        const notes = [
          { userId: d.donorId, type: "DONATION_EXPIRED" as const, title: "A listing expired", body: `"${d.title}" passed its pickup deadline.`, link: `/donations/${d.id}` },
        ];
        if (d.claimedById) {
          notes.push({ userId: d.claimedById, type: "DONATION_EXPIRED" as const, title: "A claimed donation expired", body: `"${d.title}" passed its pickup deadline before handover.`, link: "/claims" });
        }
        return notifyUsers(tx, notes);
      });
      await dispatchEmails(emails);
      result.expired++;
    } catch (error) {
      result.errors++;
      logger.warn("expiration_item_failed", { donationId: d.id, name: (error as Error).name });
    }
  }

  // 2) Confirmed or in-progress handovers that missed the deadline -> FAILED_HANDOVER.
  const late = await db.donation.findMany({
    where: { status: { in: ["CONFIRMED", "PICKUP_IN_PROGRESS"] }, pickupDeadline: { lt: now } },
    include: { delivery: true },
    take: 200,
  });
  for (const d of late) {
    try {
      const emails = await db.$transaction(async (tx) => {
        const reason = d.status === "CONFIRMED"
          ? "No volunteer collected the food before the pickup deadline."
          : "The pickup was not completed before the deadline.";
        await transitionDonation(tx, d.id, "FAILED_HANDOVER", {
          action: "HANDOVER_FAILED",
          note: reason,
          expectedFrom: [d.status as DonationStatus],
          data: { failedAt: now, failureReason: reason },
        });
        if (d.delivery && ["OPEN", "ASSIGNED", "PICKED_UP"].includes(d.delivery.status)) {
          const next = d.delivery.status === "OPEN" ? "CANCELLED" : "FAILED";
          await tx.delivery.update({
            where: { id: d.delivery.id },
            data: { status: next, failedAt: next === "FAILED" ? now : null, failureReason: next === "FAILED" ? reason : null, version: { increment: 1 } },
          });
        }
        await writeAudit(tx, { action: "system.handover_failed", entityType: "Donation", entityId: d.id, metadata: { reason } });
        const people = [d.donorId, d.claimedById, d.delivery?.volunteerId].filter((x): x is string => !!x);
        return notifyUsers(
          tx,
          people.map((userId) => ({
            userId,
            type: "HANDOVER_FAILED" as const,
            title: "Pickup deadline missed",
            body: `"${d.title}" was not handed over in time. ${reason}`,
            link: `/donations/${d.id}`,
          })),
        );
      });
      await dispatchEmails(emails);
      result.failedHandovers++;
    } catch (error) {
      result.errors++;
      logger.warn("expiration_item_failed", { donationId: d.id, name: (error as Error).name });
    }
  }

  // 3) Deadline reminders, once per donation, two hours before the deadline.
  const soon = await db.donation.findMany({
    where: {
      status: { in: ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS"] },
      deadlineReminderSentAt: null,
      pickupDeadline: { gte: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
    },
    include: { delivery: true },
    take: 200,
  });
  for (const d of soon) {
    try {
      const people = [
        { userId: d.donorId, link: `/donations/${d.id}` },
        ...(d.claimedById ? [{ userId: d.claimedById, link: `/donations/${d.id}` }] : []),
        ...(d.delivery?.volunteerId ? [{ userId: d.delivery.volunteerId, link: "/deliveries" }] : []),
      ];
      const emails = await db.$transaction(async (tx) => {
        await tx.donation.update({ where: { id: d.id }, data: { deadlineReminderSentAt: now } });
        return notifyUsers(
          tx,
          people.map((p) => ({
            userId: p.userId,
            type: "DEADLINE_REMINDER" as const,
            title: "Pickup deadline approaching",
            body: `"${d.title}" must be collected before ${d.pickupDeadline!.toISOString().slice(11, 16)} UTC.`,
            link: p.link,
          })),
        );
      });
      await dispatchEmails(emails);
      result.reminders++;
    } catch (error) {
      result.errors++;
      logger.warn("reminder_item_failed", { donationId: d.id, name: (error as Error).name });
    }
  }
  return result;
}

let lastOpportunisticRun = 0;
/** Runs the sweep at most once a minute when triggered by normal traffic. */
export async function maybeRunExpirationSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastOpportunisticRun < 60_000) return;
  lastOpportunisticRun = now;
  try {
    await runExpirationSweep(new Date(now));
  } catch (error) {
    logger.warn("opportunistic_sweep_failed", { name: (error as Error).name });
  }
}
