import { Client } from "pg";
import { db } from "@/lib/db";
import { toAuthUser } from "@/server/services/auth.service";
import type { AuthUser } from "@/server/auth/session";
import type { DonationWriteInput } from "@/validation/donation";
import { hashPassword } from "./password";

export async function resetDatabase(): Promise<void> {
  // Safety: this truncates every table. Only ever run it against a dedicated *_test database.
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to truncate non-test database "${dbName}".`);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_lastplate_sql_migrations'`,
    );
    if (rows.length) {
      await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
}

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const CENTER = { lat: 12.9716, lng: 77.5946 };

export async function makeUser(
  role: "DONOR" | "NGO" | "VOLUNTEER" | "ADMIN",
  opts: { verified?: boolean; name?: string; lat?: number; lng?: number; radius?: number; dietaryNeeds?: string[]; avoidAllergens?: string[]; maxPickupQuantity?: number | null; receivingStartHour?: number | null; receivingEndHour?: number | null; available?: boolean } = {},
): Promise<AuthUser> {
  const id = uniq();
  const lat = opts.lat ?? CENTER.lat;
  const lng = opts.lng ?? CENTER.lng;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${id}@test.lastplate`,
      passwordHash: await hashPassword("Test-Password-123"),
      fullName: opts.name ?? `${role === "NGO" ? "Hope" : role === "DONOR" ? "Chef" : "Vol"} ${id.slice(-4)}`,
      role,
      verificationStatus: opts.verified === false ? "PENDING" : "VERIFIED",
      onboardedAt: new Date(),
      phone: "+91 90000 00000",
    },
  });
  if (role === "DONOR" || role === "NGO") {
    await db.organization.create({
      data: {
        userId: user.id,
        name: `${role === "NGO" ? "Org" : "Kitchen"} ${id.slice(-5)}`,
        type: role === "NGO" ? "SHELTER" : "RESTAURANT",
        addressLine: "1 Test Street, Bengaluru",
        city: "Bengaluru",
        latitude: lat,
        longitude: lng,
        phone: "+91 90000 11111",
        serviceRadiusKm: opts.radius ?? 15,
        dietaryNeeds: opts.dietaryNeeds ?? [],
        avoidAllergens: opts.avoidAllergens ?? [],
        maxPickupQuantity: opts.maxPickupQuantity ?? null,
        receivingStartHour: opts.receivingStartHour ?? null,
        receivingEndHour: opts.receivingEndHour ?? null,
      },
    });
  }
  if (role === "VOLUNTEER") {
    await db.volunteerProfile.create({
      data: {
        userId: user.id,
        city: "Bengaluru",
        latitude: lat,
        longitude: lng,
        vehicleType: "BICYCLE",
        availability: "Anytime",
        serviceRadiusKm: opts.radius ?? 10,
        isAvailable: opts.available ?? true,
      },
    });
  }
  return toAuthUser(user);
}

export function donationPayload(overrides: Partial<DonationWriteInput> = {}): DonationWriteInput {
  const now = Date.now();
  return {
    title: `Test meal ${uniq()}`,
    description: "Cooked rice and vegetable curry, packed in steel containers for pickup.",
    category: "COOKED_MEALS",
    quantity: 10,
    unit: "PORTIONS",
    dietaryTags: ["VEGETARIAN"],
    allergens: [],
    pickupAddressLine: "1 Test Street, Bengaluru",
    pickupCity: "Bengaluru",
    pickupLatitude: CENTER.lat,
    pickupLongitude: CENTER.lng,
    pickupAreaLabel: "Test area",
    availableFrom: new Date(now + 30 * 60_000).toISOString(),
    availableUntil: new Date(now + 3 * 3600_000).toISOString(),
    pickupDeadline: new Date(now + 4 * 3600_000).toISOString(),
    ...overrides,
  };
}

export { uniq };
