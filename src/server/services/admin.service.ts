// Administrative operations. Every mutation writes an audit entry with the acting admin and IP.
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from "@/lib/errors";
import { paginate } from "@/lib/http";
import { revokeAllSessions, type AuthUser } from "../auth/session";
import * as users from "../repositories/users.repo";
import * as donations from "../repositories/donations.repo";
import { listAuditLogs, writeAudit } from "../repositories/notifications.repo";
import { notifyUsers, dispatchEmails } from "./notification.service";
import type { VerificationRequestStatus } from "@/generated/prisma/enums";

function requireAdmin(actor: AuthUser): void {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Administrator access is required.");
}

export async function listVerifications(status: VerificationRequestStatus, page: number, pageSize: number) {
  const { items, total } = await users.listVerificationRequests(status, (page - 1) * pageSize, pageSize);
  return paginate(
    items.map((r) => ({
      id: r.id,
      status: r.status,
      applicantNote: r.applicantNote,
      reviewNote: r.reviewNote,
      submittedAt: r.submittedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      user: {
        id: r.user.id,
        email: r.user.email,
        fullName: r.user.fullName,
        role: r.user.role,
        phone: r.user.phone,
        organization: r.user.organization
          ? {
              name: r.user.organization.name,
              type: r.user.organization.type,
              registrationNumber: r.user.organization.registrationNumber,
              addressLine: r.user.organization.addressLine,
              city: r.user.organization.city,
              serviceRadiusKm: r.user.organization.serviceRadiusKm,
              description: r.user.organization.description,
            }
          : null,
        volunteer: r.user.volunteerProfile
          ? { vehicleType: r.user.volunteerProfile.vehicleType, availability: r.user.volunteerProfile.availability, city: r.user.volunteerProfile.city }
          : null,
      },
    })),
    total,
    page,
    pageSize,
  );
}

export async function decideVerification(
  actor: AuthUser,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  note: string | null,
  ip: string,
) {
  requireAdmin(actor);
  const request = await users.findVerificationRequest(requestId);
  if (!request) throw new NotFoundError("Verification request not found.");
  if (request.status !== "PENDING") throw new ConflictError("This request has already been decided.", "ALREADY_DECIDED");
  if (request.userId === actor.id) throw new ForbiddenError("Admins cannot verify their own accounts.");

  const approved = decision === "APPROVE";
  const pending = await db.$transaction(async (tx) => {
    const res = await tx.verificationRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: approved ? "APPROVED" : "REJECTED", reviewerId: actor.id, reviewNote: note, reviewedAt: new Date() },
    });
    if (res.count !== 1) throw new ConflictError("This request was decided moments ago.", "ALREADY_DECIDED");
    await tx.user.update({
      where: { id: request.userId },
      data: { verificationStatus: approved ? "VERIFIED" : "REJECTED" },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: approved ? "verification.approved" : "verification.rejected",
      entityType: "VerificationRequest",
      entityId: requestId,
      metadata: { userId: request.userId, note: note ?? null },
      ip,
    });
    return notifyUsers(tx, [
      {
        userId: request.userId,
        type: "VERIFICATION_UPDATE",
        title: approved ? "Your account is verified" : "Verification needs attention",
        body: approved
          ? "Thanks for joining LastPlate. You can now use all of the features for your role."
          : `We could not verify your profile yet. ${note ?? "Please review your details and resubmit."}`,
        link: "/settings",
      },
    ]);
  });
  await dispatchEmails(pending);
  return { id: requestId, status: approved ? "APPROVED" : "REJECTED" };
}

export async function listUsers(actor: AuthUser, opts: { q?: string; role?: "DONOR" | "NGO" | "VOLUNTEER" | "ADMIN"; page: number; pageSize: number }) {
  requireAdmin(actor);
  const { items, total } = await users.listUsers({
    q: opts.q,
    role: opts.role,
    skip: (opts.page - 1) * opts.pageSize,
    take: opts.pageSize,
  });
  return paginate(
    items.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      verificationStatus: u.verificationStatus,
      organization: u.organization ? { name: u.organization.name, type: u.organization.type } : null,
      vehicle: u.volunteerProfile?.vehicleType ?? null,
      isDemo: u.isDemo,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    opts.page,
    opts.pageSize,
  );
}

export async function setUserStatus(actor: AuthUser, userId: string, status: "ACTIVE" | "SUSPENDED", reason: string, ip: string) {
  requireAdmin(actor);
  if (userId === actor.id) throw new RuleViolationError("You cannot change the status of your own account.");
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
  if (!target) throw new NotFoundError("User not found.");
  await db.$transaction(async (tx) => {
    await users.setAccountStatus(userId, status, tx);
    await writeAudit(tx, {
      actorId: actor.id,
      actorEmail: actor.email,
      action: status === "SUSPENDED" ? "user.suspended" : "user.reactivated",
      entityType: "User",
      entityId: userId,
      metadata: { reason, role: target.role },
      ip,
    });
  });
  if (status === "SUSPENDED") await revokeAllSessions(userId);
  return { id: userId, status };
}

export async function listModerationQueue(actor: AuthUser) {
  requireAdmin(actor);
  const [flagged, reports, rejected] = await Promise.all([
    db.donation.findMany({
      where: { duplicateFlagged: true, status: { in: ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS"] } },
      include: { donor: { select: { fullName: true, organization: { select: { name: true } } } } },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
    db.report.findMany({
      where: { status: "OPEN" },
      include: { donation: { select: { id: true, title: true, status: true, donor: { select: { fullName: true, organization: { select: { name: true } } } } } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.donation.findMany({
      where: { status: "REJECTED" },
      select: { id: true, title: true, rejectionReason: true, rejectedAt: true },
      orderBy: { rejectedAt: "desc" },
      take: 10,
    }),
  ]);
  return {
    duplicates: flagged.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      donor: d.donor.organization?.name ?? d.donor.fullName,
      duplicateOfId: d.duplicateOfId,
      duplicateScore: d.duplicateScore,
      publishedAt: d.publishedAt?.toISOString() ?? null,
    })),
    reports: reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      donation: { id: r.donation.id, title: r.donation.title, status: r.donation.status, donor: r.donation.donor.organization?.name ?? r.donation.donor.fullName },
    })),
    rejected: rejected.map((r) => ({ id: r.id, title: r.title, reason: r.rejectionReason, rejectedAt: r.rejectedAt?.toISOString() ?? null })),
  };
}

export async function moderate(
  actor: AuthUser,
  input: { action: "REJECT_LISTING" | "DISMISS_DUPLICATE_FLAG" | "RESOLVE_REPORT" | "DISMISS_REPORT"; reason: string; reportId?: string },
  targetId: string,
  ip: string,
) {
  requireAdmin(actor);
  if (input.action === "RESOLVE_REPORT" || input.action === "DISMISS_REPORT") {
    const report = await db.report.findUnique({ where: { id: targetId } });
    if (!report || report.status !== "OPEN") throw new NotFoundError("Open report not found.");
    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: targetId },
        data: { status: input.action === "RESOLVE_REPORT" ? "RESOLVED" : "DISMISSED", resolutionNote: input.reason, resolvedById: actor.id, resolvedAt: new Date() },
      });
      await writeAudit(tx, { actorId: actor.id, actorEmail: actor.email, action: `moderation.${input.action.toLowerCase()}`, entityType: "Report", entityId: targetId, metadata: { reason: input.reason, donationId: report.donationId }, ip });
    });
    return { id: targetId };
  }

  const d = await donations.requireDonation(targetId);
  if (input.action === "DISMISS_DUPLICATE_FLAG") {
    await db.$transaction(async (tx) => {
      await tx.donation.update({ where: { id: targetId }, data: { duplicateFlagged: false } });
      await writeAudit(tx, { actorId: actor.id, actorEmail: actor.email, action: "moderation.duplicate_dismissed", entityType: "Donation", entityId: targetId, metadata: { reason: input.reason }, ip });
    });
    return { id: targetId };
  }

  // REJECT_LISTING: only listings nobody has claimed can be rejected by moderation.
  if (d.status !== "AVAILABLE" || d.claimedById) {
    throw new ConflictError("Only unclaimed available listings can be rejected. Ask the donor to cancel claimed donations.", "NOT_MODERATABLE");
  }
  const pending = await db.$transaction(async (tx) => {
    await donations.transitionDonation(tx, targetId, "REJECTED", {
      action: "LISTING_REJECTED",
      actorId: actor.id,
      actorRole: "ADMIN",
      note: input.reason,
      expectedFrom: ["AVAILABLE"],
      data: { rejectedAt: new Date(), rejectionReason: input.reason },
    });
    await writeAudit(tx, { actorId: actor.id, actorEmail: actor.email, action: "moderation.listing_rejected", entityType: "Donation", entityId: targetId, metadata: { reason: input.reason }, ip });
    return notifyUsers(tx, [
      { userId: d.donorId, type: "LISTING_MODERATED", title: "A listing was removed", body: `"${d.title}" was removed by our moderators: ${input.reason}`, link: `/donations/${targetId}` },
    ]);
  });
  await dispatchEmails(pending);
  return { id: targetId };
}

export async function reportDonation(actor: AuthUser, donationId: string, reason: string) {
  if (actor.role === "DONOR" || actor.role === "ADMIN") throw new ForbiddenError("Only recipients and volunteers can report a listing.");
  const d = await donations.requireDonation(donationId);
  if (d.donorId === actor.id) throw new ForbiddenError("You cannot report your own listing.");
  const existing = await db.report.findFirst({ where: { donationId, reporterId: actor.id, status: "OPEN" } });
  if (existing) throw new ConflictError("You have already reported this listing. Our team is reviewing it.", "ALREADY_REPORTED");
  const report = await db.$transaction(async (tx) => {
    const r = await tx.report.create({ data: { donationId, reporterId: actor.id, reason } });
    await writeAudit(tx, { actorId: actor.id, action: "moderation.reported", entityType: "Donation", entityId: donationId, metadata: { reportId: r.id } });
    return r;
  });
  return { id: report.id };
}

export async function listAudit(opts: { action?: string; page: number; pageSize: number }) {
  const { items, total } = await listAuditLogs({ action: opts.action, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize });
  return paginate(
    items.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actorEmail: a.actorEmail,
      actorId: a.actorId,
      metadata: a.metadata,
      ip: a.ip,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    opts.page,
    opts.pageSize,
  );
}

