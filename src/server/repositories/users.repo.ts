// User, profile, session and verification persistence.
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import type { AccountStatus, Role, VerificationRequestStatus, VerificationStatus } from "@/generated/prisma/enums";

export const findUserByEmail = (email: string) => db.user.findUnique({ where: { email } });
export const findUserById = (id: string) => db.user.findUnique({ where: { id }, include: { organization: true, volunteerProfile: true } });

export async function createUser(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  isDemo?: boolean;
  verificationStatus?: VerificationStatus;
  onboardedAt?: Date | null;
  phone?: string | null;
}) {
  return db.user.create({ data });
}

export const updateUser = (id: string, data: Prisma.UserUncheckedUpdateInput, client: Tx | typeof db = db) =>
  client.user.update({ where: { id }, data });

export const countUsersByRole = () => db.user.groupBy({ by: ["role"], _count: { _all: true } });

export const listUsers = async (args: { q?: string; role?: Role; skip: number; take: number }) => {
  const where: Prisma.UserWhereInput = {
    ...(args.role ? { role: args.role } : {}),
    ...(args.q
      ? {
          OR: [
            { email: { contains: args.q.toLowerCase(), mode: "insensitive" } },
            { fullName: { contains: args.q, mode: "insensitive" } },
            { organization: { name: { contains: args.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { organization: { select: { name: true, type: true } }, volunteerProfile: { select: { vehicleType: true } } },
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    }),
    db.user.count({ where }),
  ]);
  return { items, total };
};

export const upsertOrganization = (userId: string, data: Omit<Prisma.OrganizationUncheckedCreateInput, "userId">) =>
  db.organization.upsert({
    where: { userId },
    create: { ...data, userId },
    update: data,
  });

export const upsertVolunteerProfile = (userId: string, data: Omit<Prisma.VolunteerProfileUncheckedCreateInput, "userId">) =>
  db.volunteerProfile.upsert({
    where: { userId },
    create: { ...data, userId },
    update: data,
  });

export const findVerifiedVolunteers = () =>
  db.volunteerProfile.findMany({
    where: { isAvailable: true, user: { verificationStatus: "VERIFIED", status: "ACTIVE" } },
    select: { userId: true, latitude: true, longitude: true, serviceRadiusKm: true, isAvailable: true },
    take: 1000,
  });

export const findAdminIds = async () =>
  (await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);

export async function createVerificationRequest(userId: string, applicantNote: string | null) {
  return db.verificationRequest.create({
    data: { userId, applicantNote, status: "PENDING" },
  });
}

export const findPendingVerificationForUser = (userId: string) =>
  db.verificationRequest.findFirst({ where: { userId, status: "PENDING" } });

export const listVerificationRequests = async (status: VerificationRequestStatus, skip: number, take: number) => {
  const where = { status };
  const [items, total] = await Promise.all([
    db.verificationRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            phone: true,
            organization: true,
            volunteerProfile: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
      skip,
      take,
    }),
    db.verificationRequest.count({ where }),
  ]);
  return { items, total };
};

export const findVerificationRequest = (id: string, client: Tx | typeof db = db) =>
  client.verificationRequest.findUnique({ where: { id }, include: { user: true } });

export const setAccountStatus = (userId: string, status: AccountStatus, client: Tx | typeof db = db) =>
  client.user.update({ where: { id: userId }, data: { status } });

export const createPasswordReset = (userId: string, tokenHash: string, expiresAt: Date) =>
  db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
  ]);

export const findActivePasswordReset = (tokenHash: string) =>
  db.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, email: true, status: true } } } });

export const markResetUsed = (id: string, client: Tx | typeof db = db) =>
  client.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });

export const deleteSessionsForUser = (userId: string, client: Tx | typeof db = db) =>
  client.session.deleteMany({ where: { userId } });
