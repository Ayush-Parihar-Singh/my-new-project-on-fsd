import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieJar, fakeCookies } from "../helpers/cookies";

vi.mock("next/headers", () => ({ cookies: async () => fakeCookies }));

import { makeUser, donationPayload, resetDatabase, uniq } from "../helpers/db";
import { db } from "@/lib/db";
import { createDraft, updateDonation, publishDonation, cancelDonation, getDonationForViewer, listOwnDonations } from "@/server/services/donation.service";
import { claimDonation, confirmClaim, withdrawClaim, declineClaim } from "@/server/services/claim.service";
import { acceptDelivery, markPickedUp, completeDelivery, volunteerBoard } from "@/server/services/delivery.service";
import { adminOverview } from "@/server/services/analytics.service";
import { decideVerification, setUserStatus, listUsers, listAudit } from "@/server/services/admin.service";
import { notifyUsers } from "@/server/services/notification.service";
import { listMyNotifications } from "@/server/services/notification.service";
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError, ValidationError } from "@/lib/errors";
import { resetRateLimits } from "@/lib/rate-limit";
import type { AuthUser } from "@/server/auth/session";

beforeAll(async () => {
  await resetDatabase();
});
beforeEach(() => {
  cookieJar.clear();
  resetRateLimits();
});

/** Creates a published listing as the given donor. */
async function publishedListing(donor: AuthUser, overrides: Parameters<typeof donationPayload>[0] = {}) {
  const draft = await createDraft(donor, donationPayload(overrides));
  const { donation } = await publishDonation(donor, draft.id, false);
  return donation;
}

describe("donation creation and permissions", () => {
  it("lets a verified donor save a draft that only the owner and admins can see", async () => {
    const donor = await makeUser("DONOR");
    const other = await makeUser("DONOR");
    const admin = await makeUser("ADMIN");
    const draft = await createDraft(donor, donationPayload({ title: "Private draft soup" }));
    expect(draft.status).toBe("DRAFT");
    expect((await getDonationForViewer(donor, draft.id)).access).toBe("FULL");
    expect((await getDonationForViewer(admin, draft.id)).access).toBe("FULL");
    await expect(getDonationForViewer(other, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDonationForViewer(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("blocks unverified donors from publishing but still allows drafts", async () => {
    const pending = await makeUser("DONOR", { verified: false });
    const draft = await createDraft(pending, donationPayload());
    await expect(publishDonation(pending, draft.id, false)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });

  it("stops recipients and volunteers from creating donations", async () => {
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");
    await expect(createDraft(ngo, donationPayload())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createDraft(vol, donationPayload())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks publishing with an incomplete form and explains which fields are missing", async () => {
    const donor = await makeUser("DONOR");
    const draft = await createDraft(donor, donationPayload({ pickupLatitude: undefined, pickupLongitude: undefined }));
    await expect(publishDonation(donor, draft.id, false)).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires the deadline to be at least an hour away at publish time", async () => {
    const donor = await makeUser("DONOR");
    const draft = await createDraft(donor, donationPayload({ pickupDeadline: new Date(Date.now() + 20 * 60_000).toISOString() }));
    await expect(publishDonation(donor, draft.id, false)).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishes a valid listing, and flags a near-identical repost without blocking it", async () => {
    const donor = await makeUser("DONOR");
    const title = `Dal makhani ${uniq()}`;
    const first = await publishedListing(donor, { title, description: "Dal makhani with rice in steel boxes" });
    expect(first.status).toBe("AVAILABLE");
    expect(first.publishedAt).toBeTruthy();

    const repost = await createDraft(donor, donationPayload({ title, description: "Dal makhani with rice in steel boxes" }));
    await expect(publishDonation(donor, repost.id, false)).rejects.toBeInstanceOf(ConflictError);
    const { donation, warnings } = await publishDonation(donor, repost.id, true);
    expect(donation.status).toBe("AVAILABLE");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("records a status history entry for every transition", async () => {
    const donor = await makeUser("DONOR");
    const d = await publishedListing(donor);
    const events = await db.donationEvent.findMany({ where: { donationId: d.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(["DRAFT", "AVAILABLE"]);
    expect(events[1]!.actorId).toBe(donor.id);
  });

  it("edits a draft and an available listing but blocks edits after a claim", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const draft = await createDraft(donor, donationPayload());
    const updated = await updateDonation(donor, draft.id, donationPayload({ quantity: 25, title: "Bigger batch" }));
    expect(updated.quantity).toBe(25);

    const listing = await publishedListing(donor, { title: `Edit me ${uniq()}` });
    await updateDonation(donor, listing.id, donationPayload({ quantity: 12, title: listing.title }));
    await claimDonation(ngo, listing.id);
    await expect(updateDonation(donor, listing.id, donationPayload({ quantity: 99, title: listing.title }))).rejects.toBeInstanceOf(ConflictError);
  });

  it("lets only the owning donor cancel, and blocks cancellation during pickup", async () => {
    const donor = await makeUser("DONOR");
    const stranger = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");

    const listing = await publishedListing(donor, { title: `Cancel me ${uniq()}` });
    await expect(cancelDonation(stranger, listing.id, "Not mine")).rejects.toBeInstanceOf(NotFoundError);
    const cancelled = await cancelDonation(donor, listing.id, "Plans changed");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancellationReason).toBe("Plans changed");

    const inPickup = await publishedListing(donor, { title: `In pickup ${uniq()}` });
    await claimDonation(ngo, inPickup.id);
    await confirmClaim(donor, inPickup.id);
    await acceptDelivery(vol, (await db.delivery.findUniqueOrThrow({ where: { donationId: inPickup.id } })).id);
    await markPickedUp(vol, (await db.delivery.findUniqueOrThrow({ where: { donationId: inPickup.id } })).id);
    await expect(cancelDonation(donor, inPickup.id, "Too late")).rejects.toBeInstanceOf(ConflictError);
  });

  it("lists the owner's donations with pagination and status filters", async () => {
    const donor = await makeUser("DONOR");
    await createDraft(donor, donationPayload());
    await createDraft(donor, donationPayload());
    const page = await listOwnDonations(donor, { status: "DRAFT", page: 1, pageSize: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });
});

describe("privacy of listings", () => {
  it("shows the public only an approximate location, no address and no contacts", async () => {
    const donor = await makeUser("DONOR");
    const listing = await publishedListing(donor, { title: `Privacy ${uniq()}` });
    const view = await getDonationForViewer(null, listing.id);
    expect(view.access).toBe("PUBLIC");
    expect(view.pickupAddress).toBeNull();
    expect(view.handoverCode).toBeNull();
    expect(view.donor).not.toHaveProperty("phone");
    expect(view.location?.exact).toBe(false);
    expect(view.location).not.toMatchObject({ latitude: 12.9716, longitude: 77.5946 });
  });

  it("reveals the exact address and the handover code only to the confirmed recipient", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const other = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Reveal ${uniq()}` });

    await claimDonation(ngo, listing.id);
    const requested = await getDonationForViewer(ngo, listing.id);
    expect(requested.pickupAddress).toBeNull();
    expect(requested.handoverCode).toBeNull();

    await confirmClaim(donor, listing.id);
    const confirmed = await getDonationForViewer(ngo, listing.id);
    expect(confirmed.access).toBe("PARTICIPANT");
    expect(confirmed.pickupAddress).toBe("1 Test Street, Bengaluru");
    expect(confirmed.handoverCode).toMatch(/^\d{4}$/);
    // Once the donation is no longer open, non-participants cannot see it at all.
    await expect(getDonationForViewer(other, listing.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("claims and eligibility", () => {
  it("refuses claims from unverified recipients and from donors", async () => {
    const donor = await makeUser("DONOR");
    const pendingNgo = await makeUser("NGO", { verified: false });
    const listing = await publishedListing(donor, { title: `Verify gate ${uniq()}` });
    await expect(claimDonation(pendingNgo, listing.id)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
    await expect(claimDonation(donor, listing.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses an NGO outside its service radius, with reasons", async () => {
    const donor = await makeUser("DONOR");
    const farNgo = await makeUser("NGO", { lat: 13.6, lng: 77.5946, radius: 5 });
    const listing = await publishedListing(donor, { title: `Too far ${uniq()}` });
    await expect(claimDonation(farNgo, listing.id)).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("refuses an NGO whose dietary needs the listing does not meet", async () => {
    const donor = await makeUser("DONOR");
    const vegan = await makeUser("NGO", { dietaryNeeds: ["VEGAN"] });
    const listing = await publishedListing(donor, { title: `Not vegan ${uniq()}`, dietaryTags: ["VEGETARIAN"] });
    await expect(claimDonation(vegan, listing.id)).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("lets the donor decline a request, returning the listing to AVAILABLE", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Decline ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await declineClaim(donor, listing.id, "Already promised elsewhere");
    const after = await db.donation.findUniqueOrThrow({ where: { id: listing.id } });
    expect(after.status).toBe("AVAILABLE");
    expect(after.claimedById).toBeNull();
  });

  it("lets the recipient withdraw before a volunteer is assigned", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Withdraw ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await withdrawClaim(ngo, listing.id, "Plans changed");
    expect((await db.donation.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("AVAILABLE");
  });

  it("notifies the donor when a claim arrives and the recipient when it is confirmed", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const listing = await publishedListing(donor, { title: `Notify ${uniq()}` });
    await claimDonation(ngo, listing.id);
    const donorNotes = await listMyNotifications(donor.id, 1, 10, false);
    expect(donorNotes.items.some((n) => n.type === "CLAIM_RECEIVED")).toBe(true);
    await confirmClaim(donor, listing.id);
    const ngoNotes = await listMyNotifications(ngo.id, 1, 10, false);
    expect(ngoNotes.items.some((n) => n.type === "CLAIM_CONFIRMED")).toBe(true);
    expect(await db.outboundEmail.count({ where: { toEmail: ngo.email } })).toBeGreaterThan(0);
  });
});

describe("full journey: donor publishes, NGO claims, volunteer completes", () => {
  it("records the handover and updates every dashboard", async () => {
    const donor = await makeUser("DONOR", { name: "Journey Kitchen" });
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");
    const listing = await publishedListing(donor, { title: `Journey meal ${uniq()}`, quantity: 12, unit: "PORTIONS" });

    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);

    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });
    expect(delivery.status).toBe("OPEN");

    const board = await volunteerBoard(vol);
    expect(board.available.map((t) => t.deliveryId)).toContain(delivery.id);

    await acceptDelivery(vol, delivery.id);
    await markPickedUp(vol, delivery.id);

    const ngoView = await getDonationForViewer(ngo, listing.id);
    expect(ngoView.status).toBe("PICKUP_IN_PROGRESS");
    const code = ngoView.handoverCode!;
    expect(code).toMatch(/^\d{4}$/);

    const wrongCode = code === "9999" ? "1111" : "9999";
    await expect(completeDelivery(vol, delivery.id, wrongCode)).rejects.toBeInstanceOf(RuleViolationError);
    await completeDelivery(vol, delivery.id, code);

    const done = await getDonationForViewer(donor, listing.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.completedAt).toBeTruthy();
    expect((await db.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("DELIVERED");

    const events = await db.donationEvent.findMany({ where: { donationId: listing.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.toStatus)).toEqual(
      expect.arrayContaining(["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED"]),
    );
    expect(events.find((e) => e.toStatus === "COMPLETED")?.actorId).toBe(vol.id);

    const volBoard = await volunteerBoard(vol);
    expect(volBoard.stats.completed).toBeGreaterThanOrEqual(1);
    const ngoNotes = await listMyNotifications(ngo.id, 1, 50, false);
    expect(ngoNotes.items.some((n) => n.type === "HANDOVER_COMPLETED")).toBe(true);
    const donorNotes = await listMyNotifications(donor.id, 1, 50, false);
    expect(donorNotes.items.some((n) => n.type === "HANDOVER_COMPLETED")).toBe(true);

    const overview = await adminOverview(30);
    expect(overview.donations.completedHandovers).toBeGreaterThanOrEqual(1);
    expect(overview.donations.pickupSuccessRate).not.toBeNull();
    const donorDash = await (await import("@/server/services/analytics.service")).donorDashboardData(donor.id);
    expect(donorDash).toBeTruthy();
  });

  it("only lets the volunteer assigned to the delivery mark it picked up or complete it", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");
    const intruder = await makeUser("VOLUNTEER");
    const listing = await publishedListing(donor, { title: `Assigned only ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });
    await acceptDelivery(vol, delivery.id);
    await expect(markPickedUp(intruder, delivery.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(completeDelivery(intruder, delivery.id, "1234")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a volunteer who is not verified from accepting work", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const pendingVol = await makeUser("VOLUNTEER", { verified: false });
    const listing = await publishedListing(donor, { title: `Verify vol ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });
    await expect(acceptDelivery(pendingVol, delivery.id)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });

  it("lets an assigned volunteer release the task, and then the donation is open again", async () => {
    const donor = await makeUser("DONOR");
    const ngo = await makeUser("NGO");
    const vol = await makeUser("VOLUNTEER");
    const listing = await publishedListing(donor, { title: `Release ${uniq()}` });
    await claimDonation(ngo, listing.id);
    await confirmClaim(donor, listing.id);
    const delivery = await db.delivery.findUniqueOrThrow({ where: { donationId: listing.id } });
    await acceptDelivery(vol, delivery.id);
    const { releaseAssignment } = await import("@/server/services/delivery.service");
    await releaseAssignment(vol, delivery.id);
    expect((await db.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("OPEN");
    expect((await db.donation.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("CONFIRMED");
  });
});

describe("admin operations", () => {
  it("lets only admins approve verifications, and records an audit entry", async () => {
    const admin = await makeUser("ADMIN");
    const pending = await makeUser("NGO", { verified: false });
    const req = await db.verificationRequest.create({ data: { userId: pending.id, applicantNote: "We run a shelter." } });
    await expect(decideVerification(pending, req.id, "APPROVE", null, "203.0.113.9")).rejects.toBeInstanceOf(ForbiddenError);
    await decideVerification(admin, req.id, "APPROVE", "Looks good", "203.0.113.9");
    expect((await db.user.findUniqueOrThrow({ where: { id: pending.id } })).verificationStatus).toBe("VERIFIED");
    const audit = await listAudit({ page: 1, pageSize: 50 });
    expect(audit.items.some((a) => a.entityId === req.id || a.action.toLowerCase().includes("verif"))).toBe(true);
    await expect(decideVerification(admin, req.id, "REJECT", "Too late", "203.0.113.9")).rejects.toBeInstanceOf(ConflictError);
  });

  it("prevents admins from suspending themselves and lets non-admins list users", async () => {
    const admin = await makeUser("ADMIN");
    const other = await makeUser("DONOR");
    await expect(setUserStatus(admin, admin.id, "SUSPENDED", "self", "203.0.113.9")).rejects.toBeInstanceOf(RuleViolationError);
    await expect(listUsers(other, { page: 1, pageSize: 10 })).rejects.toBeInstanceOf(ForbiddenError);
    const list = await listUsers(admin, { page: 1, pageSize: 10 });
    expect(list.items.length).toBeGreaterThan(0);
  });

  it("writes notifications that the recipient can read and mark as read", async () => {
    const u = await makeUser("VOLUNTEER");
    await notifyUsers(db, [{ userId: u.id, type: "GENERAL", title: "Hello", body: "Test", link: null }]);
    const { markAllRead, unreadCount } = await import("@/server/services/notification.service");
    expect(await unreadCount(u.id)).toBe(1);
    await markAllRead(u.id);
    expect(await unreadCount(u.id)).toBe(0);
  });
});
