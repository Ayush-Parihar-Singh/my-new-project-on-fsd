-- LastPlate initial schema (PostgreSQL). Mirrors prisma/schema.prisma.
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONOR', 'NGO', 'VOLUNTEER', 'ADMIN');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "OrgType" AS ENUM ('RESTAURANT', 'CAFE', 'HOTEL', 'HOSTEL', 'EVENT_ORGANIZER', 'COLLEGE_CANTEEN', 'NGO', 'SHELTER', 'COMMUNITY_KITCHEN', 'OTHER');
CREATE TYPE "VehicleType" AS ENUM ('ON_FOOT', 'BICYCLE', 'TWO_WHEELER', 'CAR', 'VAN');
CREATE TYPE "DonationStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'REQUESTED', 'CONFIRMED', 'PICKUP_IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED_HANDOVER');
CREATE TYPE "FoodCategory" AS ENUM ('COOKED_MEALS', 'BAKERY', 'FRESH_PRODUCE', 'DAIRY', 'BEVERAGES', 'PACKAGED_GOODS', 'DESSERTS', 'OTHER');
CREATE TYPE "QuantityUnit" AS ENUM ('KG', 'LITRES', 'PORTIONS', 'PACKS', 'PIECES');
CREATE TYPE "DeliveryStatus" AS ENUM ('OPEN', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('CLAIM_RECEIVED', 'CLAIM_WITHDRAWN', 'CLAIM_CONFIRMED', 'CLAIM_DECLINED', 'DELIVERY_AVAILABLE', 'ASSIGNMENT_ACCEPTED', 'ASSIGNMENT_RELEASED', 'PICKUP_STARTED', 'DEADLINE_REMINDER', 'DONATION_CANCELLED', 'DONATION_EXPIRED', 'HANDOVER_COMPLETED', 'HANDOVER_FAILED', 'VERIFICATION_UPDATE', 'LISTING_MODERATED', 'ACCOUNT_UPDATE', 'GENERAL');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'LOGGED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "phone" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "registrationNumber" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT,
    "operatingHours" TEXT,
    "receivingStartHour" INTEGER,
    "receivingEndHour" INTEGER,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 15,
    "dailyBeneficiaries" INTEGER,
    "maxPickupQuantity" DOUBLE PRECISION,
    "dietaryNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidAllergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VolunteerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "availability" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VolunteerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "applicantNote" TEXT,
    "reviewNote" TEXT,
    "reviewerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" "FoodCategory",
    "quantity" DOUBLE PRECISION,
    "unit" "QuantityUnit",
    "preparedAt" TIMESTAMP(3),
    "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergenNotes" TEXT,
    "pickupAddressLine" TEXT NOT NULL DEFAULT '',
    "pickupCity" TEXT NOT NULL DEFAULT '',
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "pickupAreaLabel" TEXT NOT NULL DEFAULT '',
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "pickupDeadline" TIMESTAMP(3),
    "storageInstructions" TEXT,
    "handlingInstructions" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "handoverCodeHash" TEXT,
    "handoverCodeCipher" TEXT,
    "pickupStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "expiredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deadlineReminderSentAt" TIMESTAMP(3),
    "duplicateOfId" TEXT,
    "duplicateScore" DOUBLE PRECISION,
    "duplicateFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DonationPhoto" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DonationEvent" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "DonationStatus",
    "toStatus" "DonationStatus",
    "actorId" TEXT,
    "actorRole" "Role",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DonationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'OPEN',
    "volunteerId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE UNIQUE INDEX "Organization_userId_key" ON "Organization"("userId");
CREATE INDEX "Organization_latitude_longitude_idx" ON "Organization"("latitude", "longitude");
CREATE UNIQUE INDEX "VolunteerProfile_userId_key" ON "VolunteerProfile"("userId");
CREATE INDEX "VolunteerProfile_latitude_longitude_idx" ON "VolunteerProfile"("latitude", "longitude");
CREATE INDEX "VerificationRequest_status_submittedAt_idx" ON "VerificationRequest"("status", "submittedAt");
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");
CREATE INDEX "Donation_status_pickupDeadline_idx" ON "Donation"("status", "pickupDeadline");
CREATE INDEX "Donation_donorId_status_idx" ON "Donation"("donorId", "status");
CREATE INDEX "Donation_claimedById_status_idx" ON "Donation"("claimedById", "status");
CREATE INDEX "Donation_pickupLatitude_pickupLongitude_idx" ON "Donation"("pickupLatitude", "pickupLongitude");
CREATE INDEX "Donation_duplicateFlagged_idx" ON "Donation"("duplicateFlagged");
CREATE INDEX "Donation_publishedAt_idx" ON "Donation"("publishedAt");
CREATE UNIQUE INDEX "DonationPhoto_storageKey_key" ON "DonationPhoto"("storageKey");
CREATE INDEX "DonationPhoto_donationId_idx" ON "DonationPhoto"("donationId");
CREATE INDEX "DonationEvent_donationId_createdAt_idx" ON "DonationEvent"("donationId", "createdAt");
CREATE INDEX "DonationEvent_createdAt_idx" ON "DonationEvent"("createdAt");
CREATE UNIQUE INDEX "Delivery_donationId_key" ON "Delivery"("donationId");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_volunteerId_status_idx" ON "Delivery"("volunteerId", "status");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_donationId_idx" ON "Report"("donationId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "OutboundEmail_createdAt_idx" ON "OutboundEmail"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DonationPhoto" ADD CONSTRAINT "DonationPhoto_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DonationEvent" ADD CONSTRAINT "DonationEvent_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
