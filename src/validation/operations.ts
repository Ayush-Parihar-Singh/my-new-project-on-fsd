import { z } from "zod";
import { DIETARY_TAG_VALUES } from "./profile";

export const completeDeliverySchema = z.object({
  handoverCode: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit handover code shown by the recipient."),
});

export const failDeliverySchema = z.object({
  reason: z.string().trim().min(5, "Describe what went wrong.").max(300),
});

export const claimNoteSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.decision === "APPROVE" || (v.note && v.note.length >= 5), {
    message: "Explain why the request is rejected.",
    path: ["note"],
  });

export const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().min(3, "Give a short reason for the audit trail.").max(300),
});

export const moderationActionSchema = z.object({
  action: z.enum(["REJECT_LISTING", "DISMISS_DUPLICATE_FLAG", "RESOLVE_REPORT", "DISMISS_REPORT"]),
  reason: z.string().trim().min(3, "Add a short note.").max(300),
  reportId: z.string().optional(),
});

export const discoverQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(25),
  category: z.string().max(40).optional(),
  dietary: z.enum(DIETARY_TAG_VALUES).optional(),
  sort: z.enum(["distance", "deadline", "best"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const reportSchema = z.object({
  reason: z.string().trim().min(10, "Tell us briefly what looks wrong.").max(500),
});

export const listingAssistSchema = z.object({
  text: z.string().trim().max(1000).optional(),
  photoIds: z.array(z.string().min(1).max(64)).max(3).optional().default([]),
});

export const assistantSchema = z.object({
  message: z.string().trim().min(2, "Ask a question first.").max(500),
});

export type DiscoverQueryInput = z.output<typeof discoverQuerySchema>;
