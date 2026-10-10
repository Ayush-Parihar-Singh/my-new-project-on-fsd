// Analytics for the public site, donors, recipients, volunteers and admins.
// Every number is computed from PostgreSQL at request time; demo records are counted separately so the UI can label them.
import type { DonationStatus } from "@/generated/prisma/enums";
import { FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import * as analytics from "../repositories/analytics.repo";
import * as admin from "./admin.service";
import { findEventsForDonor } from "../repositories/donations.repo";

type UnitTotal = { unit: string; label: string; quantity: number; donations: number };

function unitTotals(rows: Awaited<ReturnType<typeof analytics.quantityByUnit>>): UnitTotal[] {
  return rows
    .filter((r) => r.unit)
    .map((r) => ({
      unit: r.unit!,
      label: UNIT_LABELS[r.unit as keyof typeof UNIT_LABELS],
      quantity: Math.round((r._sum.quantity ?? 0) * 10) / 10,
      donations: r._count._all,
    }));
}

function statusMap(rows: { status: DonationStatus; _count: { _all: number } }[]): Record<DonationStatus, number> {
  const base = {
    DRAFT: 0, AVAILABLE: 0, REQUESTED: 0, CONFIRMED: 0, PICKUP_IN_PROGRESS: 0,
    COMPLETED: 0, REJECTED: 0, CANCELLED: 0, EXPIRED: 0, FAILED_HANDOVER: 0,
  } as Record<DonationStatus, number>;
  for (const r of rows) base[r.status] = r._count._all;
  return base;
}

export async function publicImpact() {
  const [statuses, completed, verifiedPartners, demo] = await Promise.all([
    analytics.statusCounts(),
    analytics.quantityByUnit("COMPLETED"),
    db.user.count({ where: { role: { in: ["DONOR", "NGO"] }, verificationStatus: "VERIFIED", status: "ACTIVE" } }),
    analytics.countDemoRecords(),
  ]);
  const byStatus = statusMap(statuses);
  return {
    completedHandovers: byStatus.COMPLETED,
    activeListings: byStatus.AVAILABLE,
    inProgress: byStatus.REQUESTED + byStatus.CONFIRMED + byStatus.PICKUP_IN_PROGRESS,
    verifiedPartners,
    recordedQuantities: unitTotals(completed),
    demo: { donations: demo.donations, totalDonations: demo.totalDonations, users: demo.users, totalUsers: demo.totalUsers },
    dataSource: "live-database" as const,
  };
}

export async function donorDashboardData(donorId: string) {
  const [statuses, completedTotals, trend, events] = await Promise.all([
    analytics.statusCounts(donorId),
    analytics.quantityByUnit("COMPLETED", donorId),
    analytics.dailyTrend(14, donorId),
    findEventsForDonor(donorId, 12),
  ]);
  const byStatus = statusMap(statuses);
  return {
    counts: {
      active: byStatus.AVAILABLE,
      pendingRequests: byStatus.REQUESTED,
      confirmedPickups: byStatus.CONFIRMED + byStatus.PICKUP_IN_PROGRESS,
      completed: byStatus.COMPLETED,
      drafts: byStatus.DRAFT,
      failed: byStatus.FAILED_HANDOVER,
    },
    completedQuantities: unitTotals(completedTotals),
    trend,
    recentActivity: events.map((e) => ({
      id: e.id,
      donationId: e.donationId,
      donationTitle: e.donation.title,
      action: e.action,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function recipientDashboardData(ngoId: string) {
  const [pending, confirmed, completed, failed] = await Promise.all([
    db.donation.count({ where: { claimedById: ngoId, status: "REQUESTED" } }),
    db.donation.count({ where: { claimedById: ngoId, status: { in: ["CONFIRMED", "PICKUP_IN_PROGRESS"] } } }),
    db.donation.count({ where: { claimedById: ngoId, status: "COMPLETED" } }),
    db.donation.count({ where: { claimedById: ngoId, status: "FAILED_HANDOVER" } }),
  ]);
  const received = await db.donation.findMany({
    where: { claimedById: ngoId, status: "COMPLETED" },
    select: { quantity: true, unit: true },
  });
  const byUnit = new Map<string, number>();
  for (const r of received) if (r.unit) byUnit.set(r.unit, (byUnit.get(r.unit) ?? 0) + (r.quantity ?? 0));
  return {
    counts: { pendingClaims: pending, confirmedCollections: confirmed, completed, failed },
    received: [...byUnit.entries()].map(([unit, quantity]) => ({
      unit,
      label: UNIT_LABELS[unit as keyof typeof UNIT_LABELS],
      quantity: Math.round(quantity * 10) / 10,
    })),
  };
}

export async function volunteerDashboardData(volunteerId: string) {
  const [grouped, delivered] = await Promise.all([
    db.delivery.groupBy({ by: ["status"], where: { volunteerId }, _count: { _all: true } }),
    analytics.completedForVolunteer(volunteerId),
  ]);
  const count = (s: string) => grouped.find((g) => g.status === s)?.["_count"]?._all ?? 0;
  const byUnit = new Map<string, number>();
  for (const d of delivered) if (d.unit) byUnit.set(d.unit, (byUnit.get(d.unit) ?? 0) + (d.quantity ?? 0));
  const monthAgo = new Date(Date.now() - 30 * 86400_000);
  return {
    completed: count("DELIVERED"),
    failed: count("FAILED"),
    active: count("ASSIGNED") + count("PICKED_UP"),
    completedLast30Days: delivered.filter((d) => d.completedAt && d.completedAt >= monthAgo).length,
    moved: [...byUnit.entries()].map(([unit, quantity]) => ({
      unit,
      label: UNIT_LABELS[unit as keyof typeof UNIT_LABELS],
      quantity: Math.round(quantity * 10) / 10,
    })),
  };
}

export async function adminOverview(days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [roleCounts, statuses, categories, trend, medianClaim, completedTotals, pendingVerifications, flagged, openReports, demo, verifiedOrgs, audit] =
    await Promise.all([
      db.user.groupBy({ by: ["role"], _count: { _all: true } }),
      analytics.statusCounts(),
      analytics.categoryCounts(since),
      analytics.dailyTrend(14),
      analytics.medianMinutesToClaim(),
      analytics.quantityByUnit("COMPLETED"),
      db.verificationRequest.count({ where: { status: "PENDING" } }),
      analytics.countFlaggedDuplicates(),
      analytics.countOpenReports(),
      analytics.countDemoRecords(),
      db.user.count({ where: { role: { in: ["DONOR", "NGO"] }, verificationStatus: "VERIFIED" } }),
      admin.listAudit({ page: 1, pageSize: 8 }),
    ]);
  const byStatus = statusMap(statuses);
  const closedAttempts = byStatus.COMPLETED + byStatus.FAILED_HANDOVER;
  return {
    days,
    users: {
      total: roleCounts.reduce((sum, r) => sum + r._count._all, 0),
      byRole: Object.fromEntries(roleCounts.map((r) => [r.role, r._count._all])) as Record<string, number>,
      verifiedOrganizations: verifiedOrgs,
    },
    donations: {
      active: byStatus.AVAILABLE + byStatus.REQUESTED + byStatus.CONFIRMED + byStatus.PICKUP_IN_PROGRESS,
      completedHandovers: byStatus.COMPLETED,
      failedPickups: byStatus.FAILED_HANDOVER,
      expired: byStatus.EXPIRED,
      cancelled: byStatus.CANCELLED,
      byStatus,
      // Success rate counts only handovers that reached a final outcome.
      pickupSuccessRate: closedAttempts > 0 ? Math.round((byStatus.COMPLETED / closedAttempts) * 1000) / 10 : null,
      medianMinutesToClaim: medianClaim,
    },
    categoryTrend: categories
      .filter((c) => c.category)
      .map((c) => ({ category: c.category!, label: FOOD_CATEGORY_LABELS[c.category!], count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    dailyTrend: trend,
    quantities: unitTotals(completedTotals),
    queues: { pendingVerifications, flaggedDuplicates: flagged, openReports },
    demo: { donations: demo.donations, totalDonations: demo.totalDonations, users: demo.users, totalUsers: demo.totalUsers },
    recentAudit: audit.items,
  };
}

/** Compact metrics handed to the AI insight summariser. Contains aggregates only, never personal data. */
export async function insightMetrics() {
  const overview = await adminOverview(30);
  return {
    windowDays: 30,
    completedHandovers: overview.donations.completedHandovers,
    failedPickups: overview.donations.failedPickups,
    expired: overview.donations.expired,
    cancelled: overview.donations.cancelled,
    pickupSuccessRatePercent: overview.donations.pickupSuccessRate,
    medianMinutesToClaim: overview.donations.medianMinutesToClaim,
    activeListings: overview.donations.active,
    topCategories: overview.categoryTrend.slice(0, 3).map((c) => ({ label: c.label, count: c.count })),
    flaggedDuplicates: overview.queues.flaggedDuplicates,
  };
}

/** Verified partner organizations for the public landing page. Names and cities only, never contacts. */
export async function publicPartners(limit = 8) {
  const rows = await db.organization.findMany({
    where: { user: { verificationStatus: "VERIFIED", status: "ACTIVE" } },
    select: { name: true, type: true, city: true, user: { select: { role: true, isDemo: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((o) => ({ name: o.name, type: o.type, city: o.city, role: o.user.role, isDemo: o.user.isDemo }));
}
