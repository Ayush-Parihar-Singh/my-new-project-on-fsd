// AI features with mandatory fallbacks. Every function returns a `source` so the UI can be honest about
// whether an answer came from the model ("AI"), from deterministic rules ("RULES") or was unavailable.
import { z } from "zod";
import { FOOD_CATEGORY_VALUES } from "@/validation/donation";
import { ALLERGEN_VALUES, DIETARY_TAG_VALUES } from "@/validation/profile";
import { env } from "@/lib/env";
import { privateStorage } from "../integrations/storage";
import { AI_DISCLAIMER, chatJson, chatText } from "../integrations/ai";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { AuthUser } from "../auth/session";
import { insightMetrics } from "./analytics.service";
import { assistantKnowledge, ASSISTANT_RULES } from "./assistant-knowledge";
import { detectImageType } from "./photo.service";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  COOKED_MEALS: ["rice", "curry", "dal", "dhal", "biryani", "pasta", "soup", "meal", "sabzi", "roti", "chapati", "noodles", "thali", "stew"],
  BAKERY: ["bread", "bun", "roll", "croissant", "muffin", "loaf", "bakery", "pastry", "cake", "toast"],
  FRESH_PRODUCE: ["vegetable", "vegetables", "fruit", "fruits", "salad", "greens", "tomato", "apple", "banana", "carrot", "onion", "produce"],
  DAIRY: ["milk", "yogurt", "yoghurt", "curd", "cheese", "paneer", "butter", "cream"],
  BEVERAGES: ["juice", "coffee", "tea", "drink", "beverage", "water", "smoothie", "lassi"],
  PACKAGED_GOODS: ["packaged", "sealed", "biscuits", "cereal", "snack", "snacks", "canned", "pack", "packets"],
  DESSERTS: ["dessert", "sweet", "sweets", "ladoo", "halwa", "pudding", "brownie", "cookie", "cookies"],
};

export const suggestionSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum(FOOD_CATEGORY_VALUES),
  description: z.string().trim().min(10).max(1000),
  dietaryTags: z.array(z.enum(DIETARY_TAG_VALUES)).max(3).default([]),
  allergensToCheck: z.array(z.enum(ALLERGEN_VALUES)).max(9).default([]),
});
export type ListingSuggestion = z.infer<typeof suggestionSchema>;

export interface ListingSuggestionResult {
  source: "AI" | "RULES" | "UNAVAILABLE";
  suggestion: ListingSuggestion | null;
  message: string;
  disclaimer: string;
}

function guessCategory(text: string): string {
  const words = text.toLowerCase().split(/[^a-z]+/);
  let best = { key: "OTHER", hits: 0 };
  for (const [key, list] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = list.filter((w) => words.includes(w)).length;
    if (hits > best.hits) best = { key, hits };
  }
  return best.key;
}

export async function suggestListing(actor: AuthUser, input: { text?: string; photoIds: string[] }): Promise<ListingSuggestionResult> {
  if (actor.role !== "DONOR") throw new ForbiddenError("Listing suggestions are available to donors.");
  consumeRateLimit(`ai-listing:${actor.id}`, 30, 60 * 60_000);
  const text = input.text?.trim() ?? "";

  // Photos are only read when the donor owns them (they are never sent to the model otherwise).
  const images: string[] = [];
  for (const id of input.photoIds) {
    const photo = await db.donationPhoto.findUnique({ where: { id }, include: { donation: { select: { donorId: true } } } });
    if (!photo || photo.donation.donorId !== actor.id) throw new NotFoundError("Photo not found.");
    if (images.length < 3 && env.aiEnabled) {
      const bytes = await privateStorage.get(photo.storageKey);
      const type = detectImageType(bytes);
      if (type) images.push(`data:${type.mime};base64,${bytes.toString("base64")}`);
    }
  }

  if (!text && input.photoIds.length === 0) {
    return { source: "UNAVAILABLE", suggestion: null, message: "Describe the food or add a photo first.", disclaimer: AI_DISCLAIMER };
  }

  if (env.aiEnabled) {
    const parsed = await chatJson(suggestionSchema, {
      system: [
        "You help food donors write clear listings for a food-rescue platform.",
        "Return JSON with keys: title, category (one of " + FOOD_CATEGORY_VALUES.join(", ") + "), description, dietaryTags (subset of " + DIETARY_TAG_VALUES.join(", ") + "), allergensToCheck (subset of " + ALLERGEN_VALUES.join(", ") + ").",
        "Describe only what is visible or stated. Never say the food is safe, fresh, edible or unspoiled - you cannot judge that from a photo.",
        "Keep the description under 300 characters and factual. Do not invent quantities.",
      ].join("\n"),
      user: text ? `Donor description: ${text}` : "Suggest a listing from the attached photo(s).",
      images: images.length ? images : undefined,
      temperature: 0.2,
    });
    if (parsed) return { source: "AI", suggestion: parsed, message: "Suggested by AI. Review and edit before publishing.", disclaimer: AI_DISCLAIMER };
  }

  if (text) {
    const category = guessCategory(text);
    const title = text.split(/[.,;\n]/)[0]!.trim().slice(0, 80) || "Surplus food";
    const suggestion: ListingSuggestion = {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category: category as ListingSuggestion["category"],
      description: `${text.slice(0, 280)}`.trim(),
      dietaryTags: /veg(etarian)?/i.test(text) && !/non[- ]?veg/i.test(text) ? ["VEGETARIAN"] : [],
      allergensToCheck: [],
    };
    if (suggestion.description.length < 10) suggestion.description = `${title}. Please add more detail before publishing.`;
    return {
      source: "RULES",
      suggestion,
      message: env.aiEnabled
        ? "The AI service did not respond, so a keyword-based draft was generated. Please review it."
        : "AI is not configured on this server, so a keyword-based draft was generated. Please review it.",
      disclaimer: AI_DISCLAIMER,
    };
  }

  return {
    source: "UNAVAILABLE",
    suggestion: null,
    message: "AI suggestions are not available right now. Please describe the food in the form instead.",
    disclaimer: AI_DISCLAIMER,
  };
}

export interface AssistantAnswer {
  source: "AI" | "RULES";
  answer: string;
  links: { label: string; href: string }[];
}

export async function assistantAnswer(user: AuthUser | null, message: string): Promise<AssistantAnswer> {
  const role = user?.role ?? "GUEST";
  consumeRateLimit(`ai-assistant:${user?.id ?? "anon"}`, 60, 60 * 60_000);
  if (env.aiEnabled) {
    const answer = await chatText({
      system: [
        "You are the LastPlate assistant. Help users understand listings, platform rules and workflows.",
        "Answer briefly (under 120 words). Use only the rules below. If unsure, say so and point to the relevant page.",
        "Never state that food is safe, fresh or edible based on a photo or description.",
        `User role: ${role}.`,
        ASSISTANT_RULES,
      ].join("\n"),
      user: message,
      temperature: 0.2,
    });
    if (answer) return { source: "AI", answer, links: [] };
  }
  const match = assistantKnowledge(message, role);
  return { source: "RULES", answer: match.answer, links: match.links };
}

export async function generateInsights() {
  const metrics = await insightMetrics();
  const rules = ruleInsights(metrics);
  if (env.aiEnabled) {
    const ai = await chatJson(
      z.object({ summary: z.string().min(10).max(600), suggestions: z.array(z.string().min(5).max(240)).min(1).max(4) }),
      {
        system: [
          "You analyse aggregate statistics for a food-rescue platform admin.",
          "Use ONLY the numbers provided. Do not invent statistics or percentages. Suggest practical ways to improve pickup success.",
          'Return JSON: {"summary": string, "suggestions": string[]}.',
        ].join("\n"),
        user: JSON.stringify(metrics),
        temperature: 0.2,
      },
    );
    if (ai) return { source: "AI" as const, metrics, summary: ai.summary, suggestions: ai.suggestions };
  }
  return { source: "RULES" as const, metrics, summary: rules.summary, suggestions: rules.suggestions };
}

export function ruleInsights(m: Awaited<ReturnType<typeof insightMetrics>>) {
  const suggestions: string[] = [];
  const closed = m.completedHandovers + m.failedPickups;
  if (closed === 0) {
    return {
      summary: "There are no completed or failed handovers in the last 30 days yet, so there is nothing to measure. Insights will appear as donations close.",
      suggestions: ["Encourage verified recipients to claim open listings early.", "Review listings with short pickup windows."],
    };
  }
  const rate = m.pickupSuccessRatePercent ?? 0;
  if (rate < 80) suggestions.push("Pickup success is below 80%. Offer volunteers larger pickup windows and send deadline reminders earlier.");
  if (m.medianMinutesToClaim != null && m.medianMinutesToClaim > 120) {
    suggestions.push("Listings take over two hours to be claimed at the median. Promote new listings to nearby verified recipients.");
  }
  if (m.expired > m.completedHandovers && m.expired > 0) {
    suggestions.push("More listings expire than complete. Consider shorter posting windows so donors publish closer to pickup.");
  }
  if (m.flaggedDuplicates > 0) suggestions.push(`${m.flaggedDuplicates} listing(s) are flagged as possible duplicates. Review them in moderation.`);
  if (suggestions.length === 0) suggestions.push("Pickup performance looks healthy. Keep monitoring deadlines and volunteer coverage.");
  return {
    summary: `In the last ${m.windowDays} days: ${m.completedHandovers} completed handover(s), ${m.failedPickups} failed pickup(s)${m.pickupSuccessRatePercent != null ? `, a ${m.pickupSuccessRatePercent}% success rate among closed handovers` : ""}.`,
    suggestions,
  };
}

