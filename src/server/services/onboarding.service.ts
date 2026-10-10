// Role-specific onboarding: organization profile (donor / recipient) or volunteer profile.
// Saving a profile for the first time submits a verification request for admin review.
import { DONOR_ORG_TYPES, RECIPIENT_ORG_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import type { ProfileInput } from "@/validation/profile";
import type { AuthUser } from "../auth/session";
import * as users from "../repositories/users.repo";
import { createNotifications, writeAudit } from "../repositories/notifications.repo";

export async function saveProfile(user: AuthUser, input: ProfileInput) {
  if (input.kind === "ORGANIZATION") {
    if (user.role !== "DONOR" && user.role !== "NGO") {
      throw new ForbiddenError("Only donors and recipient organizations have an organization profile.");
    }
    const allowed = user.role === "DONOR" ? DONOR_ORG_TYPES : RECIPIENT_ORG_TYPES;
    if (!allowed.includes(input.type)) {
      throw new ValidationError({ type: ["Choose an organization type that matches your role."] });
    }
    await users.upsertOrganization(user.id, {
      name: input.name,
      type: input.type,
      registrationNumber: input.registrationNumber || null,
      addressLine: input.addressLine,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      description: input.description || null,
      operatingHours: input.operatingHours || null,
      receivingStartHour: input.receivingStartHour ?? null,
      receivingEndHour: input.receivingEndHour ?? null,
      serviceRadiusKm: input.serviceRadiusKm,
      dailyBeneficiaries: user.role === "NGO" ? input.dailyBeneficiaries ?? null : null,
      maxPickupQuantity: user.role === "NGO" ? input.maxPickupQuantity ?? null : null,
      dietaryNeeds: user.role === "NGO" ? input.dietaryNeeds : [],
      avoidAllergens: user.role === "NGO" ? input.avoidAllergens : [],
    });
  } else {
    if (user.role !== "VOLUNTEER") throw new ForbiddenError("Only volunteers have a volunteer profile.");
    await users.upsertVolunteerProfile(user.id, {
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      vehicleType: input.vehicleType,
      availability: input.availability,
      serviceRadiusKm: input.serviceRadiusKm,
      isAvailable: input.isAvailable,
    });
  }

  const current = await users.findUserById(user.id);
  if (!current) throw new ForbiddenError();

  let verificationStatus = current.verificationStatus;
  const needsReview = current.verificationStatus === "NOT_SUBMITTED" || current.verificationStatus === "REJECTED";
  if (needsReview && !(await users.findPendingVerificationForUser(user.id))) {
    await db.$transaction(async (tx) => {
      await tx.verificationRequest.create({ data: { userId: user.id, applicantNote: input.applicantNote || null, status: "PENDING" } });
      await tx.user.update({ where: { id: user.id }, data: { verificationStatus: "PENDING", phone: input.phone, onboardedAt: current.onboardedAt ?? new Date() } });
      await createNotifications(
        tx,
        (await users.findAdminIds()).map((adminId) => ({
          userId: adminId,
          type: "VERIFICATION_UPDATE" as const,
          title: "New verification request",
          body: `${current.fullName} submitted a profile for review.`,
          link: "/admin/verifications",
        })),
      );
      await writeAudit(tx, { actorId: user.id, action: "verification.submitted", entityType: "User", entityId: user.id });
    });
    verificationStatus = "PENDING";
  } else {
    await users.updateUser(user.id, { phone: input.phone, onboardedAt: current.onboardedAt ?? new Date() });
  }
  return { verificationStatus };
}
