/**
 * Fictional demo data for LastPlate. Every user and donation created here has isDemo = true,
 * and the UI labels demo records. Run with `npm run db:seed`; `npm run db:reset-demo` wipes demo rows first.
 * Demo accounts all share DEMO_PASSWORD (default LastPlate-Demo-2026). Never seed production.
 */
import "dotenv/config";
import { copyFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { DonationStatus, FoodCategory, QuantityUnit, Role } from "../src/generated/prisma/enums";
import { encryptSecret, hashHandoverCode } from "../src/lib/crypto";

if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production. Unset APP_ENV=production to continue.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const reset = process.argv.includes("--reset");
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "LastPlate-Demo-2026";
const DEMO_DOMAIN = "lastplate-demo.test";
const DEMO_HANDOVER_CODE = "2468"; // Fixed code for demo walkthroughs only.

const now = Date.now();
const hours = (h: number) => new Date(now + h * 3600_000);
const daysAgo = (d: number, h = 0) => new Date(now - d * 86400_000 - h * 3600_000);

type SeedUser = { key: string; email: string; name: string; role: Role; status?: "PENDING" | "VERIFIED" };

const USERS: SeedUser[] = [
  { key: "admin", email: `admin@${DEMO_DOMAIN}`, name: "Maya Iyer", role: "ADMIN", status: "VERIFIED" },
  { key: "spice", email: `kitchen@spiceroute.${DEMO_DOMAIN}`, name: "Arjun Rao", role: "DONOR", status: "VERIFIED" },
  { key: "cafe", email: `hello@morningbloom.${DEMO_DOMAIN}`, name: "Leela Menon", role: "DONOR", status: "VERIFIED" },
  { key: "hotel", email: `fb@harborview.${DEMO_DOMAIN}`, name: "Daniel Fernandes", role: "DONOR", status: "VERIFIED" },
  { key: "canteen", email: `canteen@westfield.${DEMO_DOMAIN}`, name: "Sunita Verma", role: "DONOR", status: "VERIFIED" },
  { key: "hostel", email: `manager@lanternhostel.${DEMO_DOMAIN}`, name: "Kabir Shah", role: "DONOR", status: "PENDING" },
  { key: "shelter", email: `intake@ashanightshelter.${DEMO_DOMAIN}`, name: "Grace Thomas", role: "NGO", status: "VERIFIED" },
  { key: "kitchen", email: `team@eastsidekitchen.${DEMO_DOMAIN}`, name: "Imran Sheikh", role: "NGO", status: "VERIFIED" },
  { key: "newhope", email: `hello@newhopetrust.${DEMO_DOMAIN}`, name: "Farah Khan", role: "NGO", status: "PENDING" },
  { key: "bike", email: `ravi@${DEMO_DOMAIN}`, name: "Ravi Kumar", role: "VOLUNTEER", status: "VERIFIED" },
  { key: "van", email: `priya@${DEMO_DOMAIN}`, name: "Priya Nair", role: "VOLUNTEER", status: "VERIFIED" },
  { key: "newvol", email: `sam@${DEMO_DOMAIN}`, name: "Sam Mehta", role: "VOLUNTEER", status: "PENDING" },
];

const ORGS: Record<string, Prisma.OrganizationUncheckedCreateInput> = {
  spice: { userId: "", name: "Spice Route Kitchen", type: "RESTAURANT", registrationNumber: "DEMO-REG-1001", addressLine: "14 12th Main Road, Indiranagar, Bengaluru", city: "Bengaluru", latitude: 12.9719, longitude: 77.6412, phone: "+91 80000 00001", description: "Family-run restaurant serving South Indian and coastal dishes.", operatingHours: "11:00–23:00", serviceRadiusKm: 15 },
  cafe: { userId: "", name: "Morning Bloom Cafe", type: "CAFE", registrationNumber: "DEMO-REG-1002", addressLine: "88 80 Feet Road, Koramangala, Bengaluru", city: "Bengaluru", latitude: 12.9352, longitude: 77.6245, phone: "+91 80000 00002", description: "Bakery cafe with daily bread and pastry runs.", operatingHours: "07:00–21:00", serviceRadiusKm: 12 },
  hotel: { userId: "", name: "Harbor View Hotel", type: "HOTEL", registrationNumber: "DEMO-REG-1003", addressLine: "5 Outer Ring Road, Marathahalli, Bengaluru", city: "Bengaluru", latitude: 12.9592, longitude: 77.6974, phone: "+91 80000 00003", description: "Business hotel with banquet and breakfast service.", operatingHours: "24 hours", serviceRadiusKm: 20 },
  canteen: { userId: "", name: "Westfield College Canteen", type: "COLLEGE_CANTEEN", registrationNumber: "DEMO-REG-1004", addressLine: "Westfield Campus, Rajajinagar, Bengaluru", city: "Bengaluru", latitude: 13.0008, longitude: 77.5550, phone: "+91 80000 00004", description: "Campus canteen serving 1,200 students daily.", operatingHours: "08:00–18:00", serviceRadiusKm: 10 },
  hostel: { userId: "", name: "Lantern Hostel", type: "HOSTEL", addressLine: "22 Jayanagar 4th Block, Bengaluru", city: "Bengaluru", latitude: 12.9250, longitude: 77.5938, phone: "+91 80000 00005", serviceRadiusKm: 10 },
  shelter: { userId: "", name: "Asha Night Shelter", type: "SHELTER", registrationNumber: "DEMO-NGO-2001", addressLine: "7 Domlur Layout, Bengaluru", city: "Bengaluru", latitude: 12.9610, longitude: 77.6387, phone: "+91 80000 00011", description: "Overnight shelter with evening meal service.", operatingHours: "16:00–22:00", receivingStartHour: 16, receivingEndHour: 22, serviceRadiusKm: 12, dailyBeneficiaries: 120, maxPickupQuantity: 40, dietaryNeeds: [], avoidAllergens: ["PEANUTS"] },
  kitchen: { userId: "", name: "Eastside Community Kitchen", type: "COMMUNITY_KITCHEN", registrationNumber: "DEMO-NGO-2002", addressLine: "3 Pulikeshi Nagar, Bengaluru", city: "Bengaluru", latitude: 12.9980, longitude: 77.6480, phone: "+91 80000 00012", description: "Vegetarian community kitchen feeding families in the east zone.", operatingHours: "06:00–20:00", receivingStartHour: 6, receivingEndHour: 20, serviceRadiusKm: 15, dailyBeneficiaries: 300, maxPickupQuantity: 60, dietaryNeeds: ["VEGETARIAN"], avoidAllergens: [] },
  newhope: { userId: "", name: "New Hope Trust", type: "NGO", addressLine: "9 HSR Layout, Bengaluru", city: "Bengaluru", latitude: 12.9116, longitude: 77.6389, phone: "+91 80000 00013", serviceRadiusKm: 15 },
};

const VOLUNTEERS: Record<string, { lat: number; lng: number; vehicle: "BICYCLE" | "VAN" | "TWO_WHEELER"; radius: number; availability: string }> = {
  bike: { lat: 12.9500, lng: 77.6200, vehicle: "BICYCLE", radius: 8, availability: "Weekday evenings and weekend mornings" },
  van: { lat: 12.9700, lng: 77.6100, vehicle: "VAN", radius: 15, availability: "Daily, 10:00–22:00" },
  newvol: { lat: 12.9300, lng: 77.6000, vehicle: "TWO_WHEELER", radius: 6, availability: "Weekends" },
};

interface SeedDonation {
  key: string;
  donor: string;
  title: string;
  description: string;
  category: FoodCategory;
  quantity: number;
  unit: QuantityUnit;
  dietary?: string[];
  allergens?: string[];
  status: DonationStatus;
  publishedAgoH: number;
  windowFromH: number; // hours from now (negative = past)
  windowToH: number;
  deadlineH: number;
  claimant?: string;
  volunteer?: string;
  deliveryStatus?: "OPEN" | "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED" | "CANCELLED";
  completedAgoH?: number;
  reason?: string;
  flagged?: boolean;
  photo?: string;
  storage?: string;
}

const ZONE = { area: "Indiranagar", addr: "14 12th Main Road, Indiranagar" };
const DONATIONS: SeedDonation[] = [
  // Live listings (AVAILABLE)
  { key: "d1", donor: "spice", title: "Vegetable biryani and raita", description: "Freshly cooked biryani from the lunch service, packed in steel containers. Includes raita and onion salad.", category: "COOKED_MEALS", quantity: 12, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: ["DAIRY"], status: "AVAILABLE", publishedAgoH: 1.5, windowFromH: 0.5, windowToH: 3, deadlineH: 4, photo: "hero-surplus-meals.jpg" },
  { key: "d2", donor: "cafe", title: "Sourdough rolls and croissants", description: "End-of-day bakery items, still in paper bags. Mixed savoury and sweet.", category: "BAKERY", quantity: 8, unit: "PACKS", dietary: ["VEGETARIAN"], allergens: ["GLUTEN", "DAIRY", "EGGS"], status: "AVAILABLE", publishedAgoH: 2, windowFromH: 1, windowToH: 4, deadlineH: 5, photo: "bakery-basket.jpg" },
  { key: "d3", donor: "hotel", title: "Breakfast buffet surplus - fruit and salad", description: "Cut fruit, leafy salad and yoghurt from the breakfast buffet, chilled in trays.", category: "FRESH_PRODUCE", quantity: 20, unit: "KG", dietary: ["VEGETARIAN", "GLUTEN_FREE"], allergens: ["DAIRY"], status: "AVAILABLE", publishedAgoH: 4, windowFromH: 2, windowToH: 10, deadlineH: 12, photo: "fresh-produce.jpg" },
  { key: "d4", donor: "canteen", title: "Packed lunch boxes (dal rice)", description: "Sealed lunch boxes prepared for a student event that was cancelled.", category: "PACKAGED_GOODS", quantity: 30, unit: "PACKS", dietary: ["VEGETARIAN"], allergens: [], status: "AVAILABLE", publishedAgoH: 0.5, windowFromH: 0, windowToH: 2.5, deadlineH: 3, photo: "community-meals.jpg" },
  { key: "d5", donor: "spice", title: "Sweets platter - ladoo and halwa", description: "Dessert trays from a family celebration order, boxed and labelled.", category: "DESSERTS", quantity: 5, unit: "KG", dietary: ["VEGETARIAN"], allergens: ["DAIRY", "TREE_NUTS"], status: "AVAILABLE", publishedAgoH: 6, windowFromH: 3, windowToH: 8, deadlineH: 9 },
  { key: "d6", donor: "hotel", title: "Dinner buffet - rice, dal and curry", description: "Evening buffet surplus in hot-holding trays that were not served. Packed in food-grade containers.", category: "COOKED_MEALS", quantity: 25, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: ["DAIRY"], status: "AVAILABLE", publishedAgoH: 3, windowFromH: 6, windowToH: 9, deadlineH: 10, flagged: false },
  // Duplicate-flagged listing for the moderation queue (near-identical to d2)
  { key: "d7", donor: "cafe", title: "Sourdough rolls and croissants", description: "End-of-day bakery items, still in paper bags. Mixed savoury and sweet.", category: "BAKERY", quantity: 8, unit: "PACKS", dietary: ["VEGETARIAN"], allergens: ["GLUTEN", "DAIRY"], status: "AVAILABLE", publishedAgoH: 2.2, windowFromH: 1, windowToH: 4, deadlineH: 5, flagged: true },
  // In-flight handovers
  { key: "d8", donor: "cafe", title: "Pastry box for the morning shift", description: "Pastries from the morning batch, boxed for pickup.", category: "BAKERY", quantity: 6, unit: "PACKS", dietary: ["VEGETARIAN"], allergens: ["GLUTEN", "DAIRY", "EGGS"], status: "REQUESTED", publishedAgoH: 5, windowFromH: -1, windowToH: 3, deadlineH: 4, claimant: "shelter" },
  { key: "d9", donor: "hotel", title: "Vegetarian lunch trays", description: "Lunch trays from a corporate event. Vegetarian and packed.", category: "COOKED_MEALS", quantity: 18, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: ["DAIRY"], status: "CONFIRMED", publishedAgoH: 7, windowFromH: -0.5, windowToH: 3, deadlineH: 4, claimant: "kitchen" },
  { key: "d10", donor: "spice", title: "Chapati and dal, evening service", description: "Freshly made chapati and dal for the evening service. Packed in lidded containers.", category: "COOKED_MEALS", quantity: 40, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: ["GLUTEN"], status: "PICKUP_IN_PROGRESS", publishedAgoH: 6, windowFromH: -1, windowToH: 2, deadlineH: 3, claimant: "shelter", volunteer: "van", deliveryStatus: "ASSIGNED" },
  // Closed outcomes
  { key: "d11", donor: "canteen", title: "Rice and sambar, Tuesday service", description: "Canteen surplus packed for pickup.", category: "COOKED_MEALS", quantity: 22, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: [], status: "COMPLETED", publishedAgoH: 30, windowFromH: -29, windowToH: -27, deadlineH: -26, claimant: "shelter", volunteer: "bike", deliveryStatus: "DELIVERED", completedAgoH: 26 },
  { key: "d12", donor: "cafe", title: "Morning bread loaves", description: "Unsold loaves from the morning bake.", category: "BAKERY", quantity: 10, unit: "PIECES", dietary: ["VEGETARIAN"], allergens: ["GLUTEN"], status: "COMPLETED", publishedAgoH: 52, windowFromH: -50, windowToH: -48, deadlineH: -47, claimant: "kitchen", volunteer: "van", deliveryStatus: "DELIVERED", completedAgoH: 46 },
  { key: "d13", donor: "hotel", title: "Breakfast fruit trays", description: "Fruit trays from the breakfast buffet.", category: "FRESH_PRODUCE", quantity: 15, unit: "KG", dietary: ["VEGETARIAN", "VEGAN", "GLUTEN_FREE"], allergens: [], status: "COMPLETED", publishedAgoH: 74, windowFromH: -72, windowToH: -70, deadlineH: -69, claimant: "kitchen", volunteer: "bike", deliveryStatus: "DELIVERED", completedAgoH: 67 },
  { key: "d14", donor: "spice", title: "Lunch thali leftovers", description: "Thali leftovers from the lunch service.", category: "COOKED_MEALS", quantity: 28, unit: "PORTIONS", dietary: ["VEGETARIAN"], allergens: ["DAIRY"], status: "COMPLETED", publishedAgoH: 100, windowFromH: -98, windowToH: -96, deadlineH: -95, claimant: "shelter", volunteer: "van", deliveryStatus: "DELIVERED", completedAgoH: 92 },
  { key: "d15", donor: "canteen", title: "Packed snack boxes", description: "Sealed snack boxes from a campus event.", category: "PACKAGED_GOODS", quantity: 60, unit: "PACKS", dietary: ["VEGETARIAN"], allergens: ["GLUTEN"], status: "COMPLETED", publishedAgoH: 150, windowFromH: -148, windowToH: -146, deadlineH: -145, claimant: "kitchen", volunteer: "bike", deliveryStatus: "DELIVERED", completedAgoH: 140 },
  { key: "d16", donor: "hotel", title: "Dessert counter surplus", description: "Desserts from the banquet counter.", category: "DESSERTS", quantity: 4, unit: "KG", dietary: ["VEGETARIAN"], allergens: ["DAIRY", "EGGS"], status: "COMPLETED", publishedAgoH: 220, windowFromH: -218, windowToH: -216, deadlineH: -215, claimant: "shelter", volunteer: "van", deliveryStatus: "DELIVERED", completedAgoH: 210 },
  { key: "d17", donor: "cafe", title: "Cold brew and juice bottles", description: "Bottled drinks from the cafe fridge.", category: "BEVERAGES", quantity: 24, unit: "PIECES", dietary: ["VEGAN", "VEGETARIAN"], allergens: [], status: "COMPLETED", publishedAgoH: 300, windowFromH: -298, windowToH: -296, deadlineH: -295, claimant: "kitchen", volunteer: "bike", deliveryStatus: "DELIVERED", completedAgoH: 290 },
  { key: "d18", donor: "spice", title: "Dosa batter and idli", description: "Prepared idli and dosa batter from breakfast service.", category: "COOKED_MEALS", quantity: 16, unit: "PORTIONS", dietary: ["VEGETARIAN", "VEGAN"], allergens: [], status: "EXPIRED", publishedAgoH: 26, windowFromH: -10, windowToH: -6, deadlineH: -5 },
  { key: "d19", donor: "cafe", title: "Muffins and cookies", description: "Baked goods from the weekend market stall.", category: "BAKERY", quantity: 12, unit: "PIECES", dietary: ["VEGETARIAN"], allergens: ["GLUTEN", "EGGS", "DAIRY"], status: "EXPIRED", publishedAgoH: 60, windowFromH: -40, windowToH: -30, deadlineH: -28 },
  { key: "d20", donor: "hotel", title: "Gala dinner dessert trays", description: "Desserts that were not collected in time.", category: "DESSERTS", quantity: 9, unit: "KG", dietary: ["VEGETARIAN"], allergens: ["DAIRY"], status: "FAILED_HANDOVER", publishedAgoH: 120, windowFromH: -110, windowToH: -100, deadlineH: -90, claimant: "shelter", volunteer: "bike", deliveryStatus: "FAILED", reason: "Volunteer could not reach the donor before the deadline." },
  { key: "d21", donor: "canteen", title: "Old bulk rice bags", description: "Rice bags from a storage clear-out.", category: "PACKAGED_GOODS", quantity: 40, unit: "KG", dietary: ["VEGETARIAN"], allergens: [], status: "CANCELLED", publishedAgoH: 80, windowFromH: -60, windowToH: -40, deadlineH: -35, reason: "Donation was moved to a different campus drive." },
  { key: "d22", donor: "hotel", title: "Assorted cakes from a cancelled wedding", description: "Cakes and sweets from a cancelled event.", category: "DESSERTS", quantity: 7, unit: "KG", dietary: ["VEGETARIAN"], allergens: ["GLUTEN", "DAIRY", "EGGS"], status: "REJECTED", publishedAgoH: 12, windowFromH: 1, windowToH: 4, deadlineH: 5, reason: "Listing lacked the required storage and allergen detail." },
  { key: "d23", donor: "spice", title: "Draft: weekend samosa packs", description: "Draft listing - details still being added.", category: "COOKED_MEALS", quantity: 0, unit: "PIECES", status: "DRAFT", publishedAgoH: 0, windowFromH: 0, windowToH: 0, deadlineH: 0 },
];

async function wipeDemo() {
  await db.notification.deleteMany({ where: { user: { isDemo: true } } });
  await db.donationEvent.deleteMany({ where: { donation: { isDemo: true } } });
  await db.donationPhoto.deleteMany({ where: { donation: { isDemo: true } } });
  await db.report.deleteMany({ where: { donation: { isDemo: true } } });
  await db.delivery.deleteMany({ where: { donation: { isDemo: true } } });
  await db.donation.deleteMany({ where: { isDemo: true } });
  await db.session.deleteMany({ where: { user: { isDemo: true } } });
  await db.verificationRequest.deleteMany({ where: { user: { isDemo: true } } });
  await db.organization.deleteMany({ where: { user: { isDemo: true } } });
  await db.volunteerProfile.deleteMany({ where: { user: { isDemo: true } } });
  await db.user.deleteMany({ where: { isDemo: true } });
  await db.auditLog.deleteMany({ where: { action: { startsWith: "demo." } } });
  await db.outboundEmail.deleteMany({ where: { subject: { startsWith: "[DEMO]" } } });
}

async function main() {
  if (reset) {
    console.log("Removing existing demo rows…");
    await wipeDemo();
  }
  const existing = await db.user.count({ where: { isDemo: true } });
  if (existing > 0 && !reset) {
    console.log(`Demo data already present (${existing} demo users). Use --reset to rebuild it.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const created = await db.user.create({
      data: {
        email: u.email,
        passwordHash,
        fullName: u.name,
        role: u.role,
        isDemo: true,
        phone: u.role === "ADMIN" ? null : "+91 80000 0000" + String(Object.keys(ids).length).padStart(1, "0"),
        onboardedAt: daysAgo(40),
        verificationStatus: u.status ?? "NOT_SUBMITTED",
        lastLoginAt: daysAgo(1),
      },
    });
    ids[u.key] = created.id;
    if (u.status === "PENDING") {
      await db.verificationRequest.create({ data: { userId: created.id, status: "PENDING", applicantNote: "Demo verification request awaiting review.", submittedAt: daysAgo(2) } });
    } else if (u.status === "VERIFIED" && u.role !== "ADMIN") {
      await db.verificationRequest.create({ data: { userId: created.id, status: "APPROVED", applicantNote: "Demo registration documents.", reviewerId: ids.admin ?? null, reviewNote: "Demo approval", submittedAt: daysAgo(30), reviewedAt: daysAgo(29) } });
    }
  }
  // Admin row was created first; backfill reviewer ids for approvals.
  await db.verificationRequest.updateMany({ where: { reviewerId: null, status: "APPROVED" }, data: { reviewerId: ids.admin } });

  for (const [key, org] of Object.entries(ORGS)) {
    await db.organization.create({ data: { ...org, userId: ids[key]! } });
  }
  for (const [key, v] of Object.entries(VOLUNTEERS)) {
    await db.volunteerProfile.create({
      data: { userId: ids[key]!, city: "Bengaluru", latitude: v.lat, longitude: v.lng, vehicleType: v.vehicle, availability: v.availability, serviceRadiusKm: v.radius, isAvailable: true },
    });
  }

  const storageDir = path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "./storage");
  await mkdir(storageDir, { recursive: true, mode: 0o700 });
  const photoIdsByDonation = new Map<string, string>();

  for (const d of DONATIONS) {
    const donorId = ids[d.donor]!;
    const claimantId = d.claimant ? ids[d.claimant] : undefined;
    const publishedAt = d.status === "DRAFT" ? null : daysAgo(0, d.publishedAgoH);
    const isDraft = d.status === "DRAFT";
    const org = ORGS[d.donor]!;
    const pickupDeadline = hours(d.deadlineH);
    const data: Prisma.DonationUncheckedCreateInput = {
      donorId,
      status: d.status,
      title: d.title,
      description: d.description,
      category: d.category,
      quantity: d.quantity || null,
      unit: d.unit,
      dietaryTags: d.dietary ?? [],
      allergens: d.allergens ?? [],
      allergenNotes: d.allergens?.length ? "Allergens listed as prepared in a shared kitchen." : null,
      pickupAddressLine: org.addressLine,
      pickupCity: "Bengaluru",
      pickupLatitude: org.latitude,
      pickupLongitude: org.longitude,
      pickupAreaLabel: ZONE.area,
      availableFrom: isDraft ? null : hours(d.windowFromH),
      availableUntil: isDraft ? null : hours(d.windowToH),
      pickupDeadline: isDraft ? null : pickupDeadline,
      storageInstructions: isDraft ? null : "Keep covered and refrigerated until pickup where applicable.",
      handlingInstructions: isDraft ? null : "Ask for the kitchen desk at the staff entrance.",
      isDemo: true,
      publishedAt,
      claimedById: claimantId ?? null,
      claimedAt: claimantId ? daysAgo(0, Math.max(0, d.publishedAgoH - 1)) : null,
      confirmedAt: ["CONFIRMED", "PICKUP_IN_PROGRESS", "COMPLETED", "FAILED_HANDOVER"].includes(d.status) ? daysAgo(0, Math.max(0, d.publishedAgoH - 2)) : null,
      pickupStartedAt: d.status === "PICKUP_IN_PROGRESS" ? daysAgo(0, 0.5) : null,
      completedAt: d.status === "COMPLETED" ? daysAgo(0, d.completedAgoH ?? 1) : null,
      cancelledAt: d.status === "CANCELLED" ? daysAgo(0, 40) : null,
      cancellationReason: d.status === "CANCELLED" ? d.reason ?? null : null,
      expiredAt: d.status === "EXPIRED" ? daysAgo(0, Math.abs(d.deadlineH) - 1) : null,
      failedAt: d.status === "FAILED_HANDOVER" ? daysAgo(0, Math.abs(d.deadlineH)) : null,
      failureReason: d.status === "FAILED_HANDOVER" ? d.reason ?? "Pickup not completed before the deadline." : null,
      rejectedAt: d.status === "REJECTED" ? daysAgo(0, 2) : null,
      rejectionReason: d.status === "REJECTED" ? d.reason ?? null : null,
      duplicateFlagged: !!d.flagged,
      duplicateScore: d.flagged ? 0.85 : null,
      version: 1,
    };
    const donation = await db.donation.create({ data });
    if (["CONFIRMED", "PICKUP_IN_PROGRESS"].includes(d.status)) {
      // Real hashing/encryption from the application, so the demo code works in the running app.
      await db.donation.update({
        where: { id: donation.id },
        data: { handoverCodeHash: hashHandoverCode(donation.id, DEMO_HANDOVER_CODE), handoverCodeCipher: encryptSecret(DEMO_HANDOVER_CODE) },
      });
    }
    await db.donationEvent.create({ data: { donationId: donation.id, action: "CREATED", toStatus: "DRAFT", actorId: donorId, actorRole: "DONOR", createdAt: daysAgo(0, (d.publishedAgoH ?? 0) + 0.5) } });
    if (!isDraft) {
      await db.donationEvent.create({ data: { donationId: donation.id, action: "PUBLISHED", fromStatus: "DRAFT", toStatus: "AVAILABLE", actorId: donorId, actorRole: "DONOR", createdAt: publishedAt! } });
    }
    if (d.status !== "AVAILABLE" && d.status !== "DRAFT") {
      await db.donationEvent.create({ data: { donationId: donation.id, action: "STATUS_SEEDED", fromStatus: "AVAILABLE", toStatus: d.status, actorId: claimantId ?? donorId, actorRole: claimantId ? "NGO" : "ADMIN", note: d.reason ?? null, createdAt: daysAgo(0, Math.max(0.2, (d.completedAgoH ?? d.publishedAgoH - 1))) } });
    }

    if (d.volunteer && d.deliveryStatus) {
      const volId = ids[d.volunteer]!;
      const status = d.deliveryStatus;
      await db.delivery.create({
        data: {
          donationId: donation.id,
          status,
          volunteerId: volId,
          assignedAt: daysAgo(0, Math.max(0.1, d.publishedAgoH - 2)),
          pickedUpAt: ["PICKED_UP", "DELIVERED"].includes(status) ? daysAgo(0, Math.max(0.1, (d.completedAgoH ?? 1) + 0.5)) : null,
          deliveredAt: status === "DELIVERED" ? daysAgo(0, d.completedAgoH ?? 1) : null,
          failedAt: status === "FAILED" ? daysAgo(0, Math.abs(d.deadlineH)) : null,
          failureReason: status === "FAILED" ? d.reason ?? null : null,
        },
      });
    } else if (claimantId && d.status === "CONFIRMED") {
      await db.delivery.create({ data: { donationId: donation.id, status: "OPEN" } });
    }

    if (d.photo) {
      const key = `demo-${randomBytes(12).toString("base64url")}.jpg`;
      await copyFile(path.join(process.cwd(), "public", "images", d.photo), path.join(storageDir, key));
      const photo = await db.donationPhoto.create({ data: { donationId: donation.id, storageKey: key, mimeType: "image/jpeg", sizeBytes: 0, uploadedById: donorId } });
      photoIdsByDonation.set(d.key, photo.id);
    }
  }

  // Notifications for demo users (in-app inbox examples).
  const notes: Prisma.NotificationUncheckedCreateInput[] = [
    { userId: ids.spice!, type: "CLAIM_RECEIVED", title: "A recipient wants your donation", body: "Asha Night Shelter requested \"Pastry box for the morning shift\". Confirm the claim to arrange pickup.", link: "/donations" },
    { userId: ids.shelter!, type: "CLAIM_CONFIRMED", title: "Claim confirmed - arrange pickup", body: "Your claim for \"Chapati and dal, evening service\" is confirmed. Your handover code is on the donation page.", link: "/claims" },
    { userId: ids.van!, type: "ASSIGNMENT_ACCEPTED", title: "Pickup accepted", body: "You accepted \"Chapati and dal, evening service\". Collect it before the deadline.", link: "/deliveries" },
    { userId: ids.bike!, type: "DELIVERY_AVAILABLE", title: "New delivery task nearby", body: "\"Vegetarian lunch trays\" needs a volunteer before the deadline.", link: "/deliveries" },
    { userId: ids.admin!, type: "VERIFICATION_UPDATE", title: "New verification request", body: "New Hope Trust submitted a profile for review.", link: "/admin/verifications" },
    { userId: ids.kitchen!, type: "HANDOVER_COMPLETED", title: "Handover completed", body: "\"Morning bread loaves\" was delivered and confirmed.", link: "/claims" },
  ];
  await db.notification.createMany({ data: notes });
  await db.auditLog.createMany({
    data: [
      { actorId: ids.admin, actorEmail: `admin@${DEMO_DOMAIN}`, action: "demo.verification.approved", entityType: "VerificationRequest", metadata: { note: "Demo seed" }, createdAt: daysAgo(29) },
      { actorId: ids.admin, actorEmail: `admin@${DEMO_DOMAIN}`, action: "demo.moderation.duplicate_dismissed", entityType: "Donation", metadata: { note: "Demo seed" }, createdAt: daysAgo(3) },
    ],
  });
  await db.outboundEmail.create({ data: { toEmail: `kitchen@spiceroute.${DEMO_DOMAIN}`, subject: "[DEMO] Claim received", body: "Demo email (not sent).", status: "LOGGED" } });

  console.log("\nLastPlate demo data ready.");
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  for (const u of USERS) console.log(`  ${u.role.padEnd(9)} ${u.email.padEnd(42)} ${u.status ?? ""}`);
  console.log(`Demo handover code for seeded in-progress donations: ${DEMO_HANDOVER_CODE}`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
