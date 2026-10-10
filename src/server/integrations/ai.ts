// OpenAI-compatible Chat Completions client. Runs server-side only; the API key never reaches the browser.
// Every call has a timeout and returns null on failure so callers can use deterministic fallbacks.
import type { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const AI_DISCLAIMER =
  "AI suggestions are based only on the text and photos you provide. LastPlate cannot determine food safety, freshness or edibility from a photo. Please check the food yourself and confirm every field.";

interface ChatOptions {
  system: string;
  user: string;
  images?: string[]; // data URLs (image/jpeg|png|webp)
  json?: boolean;
  temperature?: number;
}

async function chat(options: ChatOptions): Promise<string | null> {
  if (!env.aiEnabled) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const userContent = options.images?.length
      ? [
          { type: "text", text: options.user },
          ...options.images.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } })),
        ]
      : options.user;
    const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: options.temperature ?? 0.2,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: userContent },
        ],
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("ai_http_error", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    logger.warn("ai_unavailable", { reason: (error as Error).name });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function chatText(options: Omit<ChatOptions, "json">): Promise<string | null> {
  const content = await chat(options);
  return content?.trim() || null;
}

export async function chatJson<T>(schema: z.ZodType<T>, options: Omit<ChatOptions, "json">): Promise<T | null> {
  const content = await chat({ ...options, json: true });
  if (!content) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
