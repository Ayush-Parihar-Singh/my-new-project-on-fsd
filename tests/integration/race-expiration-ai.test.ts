import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieJar, fakeCookies } from "../helpers/cookies";

vi.mock("next/headers", () => ({ cookies: async () => fakeCookies }));

import { makeUser, donationPayload, resetDatabase, uniq } from "../helpers/db";
import { db } from "@/lib/db";
import { createDraft, publishDonation, getDonationForViewer, cancelDonation } from "@/server/services/donation.service";
import { claimDonation, confirmClaim } from "@/server/services/claim.service";
import { acceptDelivery, markPickedUp, reportFailure, completeDelivery } from "@/server/services/delivery.service";
import { runExpirationSweep } from "@/server/services/expiration.service";
import { suggestListing, assistantAnswer, generateInsights } from "@/server/services/ai.service";
import { publicImpact, adminOverview } from "@/server/services/analytics.service";
import { listMyNotifications } from "@/server/services/notification.service";
import { ForbiddenError, ConflictError } from "@/lib/errors";
import { resetRateLimits } from "@/lib/rate-limit";
import type { AuthUser } from "@/server/auth/session";

beforeAll(async () => {
  await resetDatabase();
});
beforeEach(() => {
  cookieJar.clear();
  resetRateLimits();
});

async function publishedListing(donor: AuthUser, overrides: Parameters<typeof donationPayload>[0] = {}) {
  const draft = await createDraft(donor, donationPayload(overrides));
  return (await publishDonation(donor, draft.id, false)).donation;
}

/** Moves the deadline into the past directly, to simulate time passing in tests. */
async function expireDeadline(id: string) {
  await db.donation.update({ where: { id }, data: { pickupDeadline: new Date(Date.now() - 60_000), availableUntil: new Date(Date.now() - 2 * 60_000) } });
}

describe("no double claims under concurrency", () => {
  it("lets exactly one of many simultaneous recipients claim a listing", async () => {
    const donor = await makeUser("DONOR");
    const recipients = await Promise.all(Array.from({ length: 6 }, () => makeUser("NGO")));
    const listing = await publishedListing(donor, { title: `Race ${uniq()}` });

    const results = await Promise.allSettled(recipients.map((r) => claimDonation(r, listing.id)));
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(recipients.length - 1);
    for (const l of lost) {
      expect(l.reason).toBeInstanceOf(ConflictError);
      expect((l.reason as ConflictError).code).toBe("ALREADY_CLAIMED");
    }
    const row = await db.donation.findUniqueOrThrow({ where: { id: listing.id } });
    const winner = recipients.find((r) => r.id === row.claimedById);
    expect(winner).toBeDefined();
    expect(row.status).toBe("REQUESTED");
    const claimEvents = await db.donationEvent.count({ where: { donationId: listing.id, toStatus: "REQUESTED" } });
    expect(claimEvents).toBe(1);
  });

  it("lets only one volunteer accept the same delivery task at once", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const vols = await Promise.all(Array.from({ length: 4 }, () => makeUser("VOLUNTEER")));
    const listing = await publishedListing(donor, { title: `Volunteer race ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });

    const results = await Promise.allSettled(vols.map((v) => acceptDelivery(v, delivery.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const row = await db.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(row.status).toBe("ASSIGNED");
    expect(vols.map((v) => v.id)).toContain(row.volunteerId);
  });
});

describe("cancellation rules", () => {
  it("notifies the recipient and cancels the delivery when a donor cancels a confirmed donation", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Cancel notify ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    await cancelDonation(donor, listing.id, "Kitchen closed unexpectedly");
    const notes = await listMyNotifications(ngo.id, 1, 20, false);
    expect(notes.items.some((n) => n.type === "DONATION_CANCELLED")).toBe(true);
    expect((await db.delivery.findUnique({ where: { donationId: listing.id } }))?.status).toBe("CANCELLED");
  });
});

describe("expiration and failed handovers", () => {
  it("expires unclaimed listings past their deadline, exactly once", async () => {
    const donor = await makeUser("DONOR");
    const listing = await publishedListing(donor, { title: `Stale ${uniq()}` });
    await expireDeadline(listing.id);
    const first = await runExpirationSweep();
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect((await db.donation.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("EXPIRED");
    const second = await runExpirationSweep();
    expect(second.errors).toBe(0);
    expect((await db.donation.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("EXPIRED");
    const notes = await listMyNotifications(donor.id, 1, 50, false);
    expect(notes.items.filter((n) => n.type === "DONATION_EXPIRED" && n.link?.includes(listing.id))).toHaveLength(1);
  });

  it("fails a confirmed but never-collected handover and cancels its open task", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Unclaimed pickup ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    await expireDeadline(listing.id);
    await runExpirationSweep();
    const d = await db.donation.findUniqueOrThrow({ where: { id: listing.id } });
    expect(d.status).toBe("FAILED_HANDOVER");
    expect(d.failureReason).toMatch(/volunteer/i);
    expect((await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } })).status).toBe("CANCELLED");
  });

  it("records a volunteer-reported failed pickup as FAILED_HANDOVER", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");
    const listing = await publishedListing(donor, { title: `Failed pickup ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });
    await acceptDelivery(vol, delivery.id);
    await reportFailure(vol, delivery.id, "Donor was closed when I arrived");
    expect((await db.donation.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("FAILED_HANDOVER");
    expect((await db.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("FAILED");
    await expect(completeDelivery(vol, delivery.id, "1234")).rejects.toBeInstanceOf(ConflictError);
  });

  it("sends a single deadline reminder per listing", async () => {
    const donor = await makeUser("DONOR");
    const draft = await createDraft(donor, donationPayload({
      title: `Reminder ${uniq()}`,
      availableUntil: new Date(Date.now() + 80 * 60_000).toISOString(),
      pickupDeadline: new Date(Date.now() + 90 * 60_000).toISOString(),
    }));
    const { donation } = await publishDonation(donor, draft.id, false);
    await runExpirationSweep();
    await runExpirationSweep();
    const row = await db.donation.findUniqueOrThrow({ where: { id: donation.id } });
    expect(row.deadlineReminderSentAt).not.toBeNull();
    const reminders = await db.notification.count({ where: { userId: donor.id, type: "DEADLINE_REMINDER", link: { contains: donation.id } } });
    expect(reminders).toBe(1);
  });
});

describe("AI features degrade gracefully without a model", () => {
  it("suggests listing details from text as a rules-based draft that the donor must confirm", async () => {
    const donor = await makeUser("DONOR");
    const r = await suggestListing(donor, { text: "Vegetable biryani with raita, around 20 portions, cooked this morning", photoIds: [] });
    expect(r.source).toBe("RULES");
    expect(r.suggestion?.title).toBeTruthy();
    expect(r.disclaimer.toLowerCase()).toContain("not");
    expect(r.message.toLowerCase()).toMatch(/review|confirm|edit/);
  });

  it("reports UNAVAILABLE with a helpful message when there is no input", async () => {
    const donor = await makeUser("DONOR");
    const r = await suggestListing(donor, { text: "", photoIds: [] });
    expect(r.source).toBe("UNAVAILABLE");
    expect(r.suggestion).toBeNull();
  });

  it("is restricted to donors", async () => {
    const ngo = await makeUser("NGO");
    await expect(suggestListing(ngo, { text: "rice", photoIds: [] })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("answers assistant questions from curated rules and refuses to judge food safety", async () => {
    const safety = await assistantAnswer(null, "Can you tell from this photo if the food is safe to eat?");
    expect(safety.source).toBe("RULES");
    expect(safety.answer.toLowerCase()).toMatch(/cannot|can't|not able|don't/);
    const howTo = await assistantAnswer(null, "How do I donate surplus food?");
    expect(howTo.answer.length).toBeGreaterThan(20);
  });

  it("produces insights from database metrics only, and says so when there is no data", async () => {
    const insights = await generateInsights();
    expect(insights.source).toBe("RULES");
    expect(insights.metrics.windowDays).toBe(30);
    expect(insights.summary.length).toBeGreaterThan(10);
  });
});

describe("analytics reflect the database", () => {
  it("reports live counts and labels demo data separately", async () => {
    const impact = await publicImpact();
    expect(impact.dataSource).toBe("live-database");
    expect(impact.demo).toHaveProperty("donations");
    const overview = await adminOverview(30);
    expect(overview.donations.active).toBeGreaterThanOrEqual(0);
    expect(overview.dailyTrend.length).toBeGreaterThan(0);
    // Every donation row is counted in exactly one status bucket.
    const total = Object.values(overview.donations.byStatus).reduce((a, b) => a + b, 0);
    expect(total).toBe(await db.donation.count());
    expect(overview.donations.byStatus.COMPLETED).toBe(await db.donation.count({ where: { status: "COMPLETED" } }));
  });

  it("returns a donor's own listing with full detail", async () => {
    const donor = await makeUser("DONOR");
    const listing = await publishedListing(donor, { title: `Mine ${uniq()}` });
    const view = await getDonationForViewer(donor, listing.id);
    expect(view.access).toBe("FULL");
    expect(view.pickupAddress).toBe("1 Test Street, Bengaluru");
  });
});
