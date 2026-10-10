import { describe, expect, it } from "vitest";
import { duplicateScore, findDuplicates, jaccard, DUPLICATE_THRESHOLD } from "@/domain/duplicates";
import { approximateLocation, haversineKm } from "@/domain/geo";
import { accessLevel } from "@/domain/visibility";

const now = new Date("2026-10-10T10:00:00Z");
const subject = { donorId: "donor-1", title: "Vegetable biryani", description: "Steel containers with raita", latitude: 12.97, longitude: 77.59, at: now };

describe("duplicate detection", () => {
  it("scores identical listings from the same donor at the threshold or above", () => {
    expect(duplicateScore(subject, { ...subject, id: "x" })).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("ignores listings from different donors", () => {
    expect(duplicateScore(subject, { ...subject, donorId: "donor-2" })).toBe(0);
  });

  it("does not flag clearly different food from the same donor", () => {
    const other = { ...subject, id: "y", title: "Chocolate cake", description: "Slices from a birthday order", latitude: 12.99, longitude: 77.7, at: new Date(now.getTime() - 48 * 3600_000) };
    expect(findDuplicates(subject, [other])).toHaveLength(0);
  });

  it("computes token overlap", () => {
    expect(jaccard("rice and dal", "dal rice")).toBe(1);
    expect(jaccard("", "")).toBe(0);
  });
});

describe("geo helpers", () => {
  it("computes distance in km", () => {
    const d = haversineKm({ latitude: 12.9716, longitude: 77.5946 }, { latitude: 13.0716, longitude: 77.5946 });
    expect(d).toBeGreaterThan(10.9);
    expect(d).toBeLessThan(11.2);
  });

  it("fuzzes public coordinates deterministically within about 350 m", () => {
    const exact = { latitude: 12.9716, longitude: 77.5946 };
    const a = approximateLocation(exact, "donation-abc");
    const b = approximateLocation(exact, "donation-abc");
    expect(a).toEqual(b);
    expect(haversineKm(exact, a)).toBeGreaterThan(0.05);
    expect(haversineKm(exact, a)).toBeLessThan(0.36);
  });
});

describe("visibility rules", () => {
  const base = {
    donorId: "donor",
    claimedById: "ngo",
    status: "CONFIRMED" as const,
    delivery: { volunteerId: "vol", status: "ASSIGNED" },
  };
  it("gives donors and admins full access", () => {
    expect(accessLevel({ id: "donor", role: "DONOR", verificationStatus: "VERIFIED" }, base)).toBe("FULL");
    expect(accessLevel({ id: "admin", role: "ADMIN", verificationStatus: "VERIFIED" }, base)).toBe("FULL");
  });
  it("gives the claiming recipient participant access only after confirmation", () => {
    expect(accessLevel({ id: "ngo", role: "NGO", verificationStatus: "VERIFIED" }, base)).toBe("PARTICIPANT");
    expect(accessLevel({ id: "ngo", role: "NGO", verificationStatus: "VERIFIED" }, { ...base, status: "REQUESTED" })).toBe("PUBLIC");
  });
  it("gives the assigned volunteer participant access and strangers public access", () => {
    expect(accessLevel({ id: "vol", role: "VOLUNTEER", verificationStatus: "VERIFIED" }, base)).toBe("PARTICIPANT");
    expect(accessLevel({ id: "other", role: "VOLUNTEER", verificationStatus: "VERIFIED" }, base)).toBe("PUBLIC");
    expect(accessLevel(null, base)).toBe("PUBLIC");
  });
});
