// Analytics queries. Aggregations run in PostgreSQL; nothing here is hard-coded or sampled.
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { DonationStatus } from "@/generated/prisma/enums";

export const statusCounts = async (donorId?: string) =>
  db.donation.groupBy({
    by: ["status"],
    where: donorId ? { donorId } : {},
    _count: { _all: true },
  });

export const categoryCounts = async (since: Date) =>
  db.donation.groupBy({
    by: ["category"],
    where: { publishedAt: { gte: since }, category: { not: null } },
    _count: { _all: true },
  });

export const quantityByUnit = async (status: DonationStatus, donorId?: string) =>
  db.donation.groupBy({
    by: ["unit"],
    where: { status, unit: { not: null }, ...(donorId ? { donorId } : {}) },
    _sum: { quantity: true },
    _count: { _all: true },
  });

interface DayRow {
  day: Date;
  published: bigint;
  completed: bigint;
}

/** Published and completed counts per UTC day for the last `days` days. */
export async function dailyTrend(days: number, donorId?: string): Promise<{ day: string; published: number; completed: number }[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const donorFilter = donorId ? Prisma.sql`AND "donorId" = ${donorId}` : Prisma.empty;
  const rows = await db.$queryRaw<DayRow[]>(Prisma.sql`
    SELECT d.day,
           COALESCE(p.published, 0) AS published,
           COALESCE(c.completed, 0) AS completed
    FROM generate_series(${since}::timestamp, now(), interval '1 day') AS d(day)
    LEFT JOIN (
      SELECT date_trunc('day', "publishedAt") AS day, COUNT(*) AS published
      FROM "Donation" WHERE "publishedAt" >= ${since} ${donorFilter}
      GROUP BY 1
    ) p ON p.day = d.day
    LEFT JOIN (
      SELECT date_trunc('day', "completedAt") AS day, COUNT(*) AS completed
      FROM "Donation" WHERE "completedAt" >= ${since} ${donorFilter}
      GROUP BY 1
    ) c ON c.day = d.day
    ORDER BY d.day`);
  return rows.map((r) => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    published: Number(r.published),
    completed: Number(r.completed),
  }));
}

/** Median minutes from publication to recipient claim (null when there is no data yet). */
export async function medianMinutesToClaim(): Promise<number | null> {
  const rows = await db.$queryRaw<{ median: number | null }[]>(Prisma.sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("claimedAt" - "publishedAt")) / 60) AS median
    FROM "Donation" WHERE "claimedAt" IS NOT NULL AND "publishedAt" IS NOT NULL`);
  const value = rows[0]?.median;
  return value == null ? null : Math.round(Number(value));
}

export const completedForVolunteer = (volunteerId: string) =>
  db.donation.findMany({
    where: { delivery: { volunteerId, status: "DELIVERED" } },
    select: { quantity: true, unit: true, completedAt: true },
  });

export const countUsers = async (where: Prisma.UserWhereInput) => db.user.count({ where });
export const countDonations = async (where: Prisma.DonationWhereInput) => db.donation.count({ where });
export const countFlaggedDuplicates = () => db.donation.count({ where: { duplicateFlagged: true, status: { in: ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS"] } } });
export const countOpenReports = () => db.report.count({ where: { status: "OPEN" } });
export const countDemoRecords = async () => ({
  users: await db.user.count({ where: { isDemo: true } }),
  donations: await db.donation.count({ where: { isDemo: true } }),
  totalUsers: await db.user.count(),
  totalDonations: await db.donation.count(),
});
