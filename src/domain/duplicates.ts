// Duplicate detection heuristics (pure). Flags - never blocks - suspicious listings.
// Signals: same donor, similar title/description, nearby pickup point, close posting time.
import { haversineKm } from "./geo";

export interface DuplicateSubject {
  id?: string;
  donorId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  at: Date;
}

export const DUPLICATE_THRESHOLD = 0.75;
const STOPWORDS = new Set(["a", "an", "and", "the", "of", "with", "for", "to", "in", "on", "from", "some", "extra"]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function duplicateScore(a: DuplicateSubject, b: DuplicateSubject): number {
  if (a.donorId !== b.donorId) return 0;
  const titleSim = jaccard(a.title, b.title);
  const descSim = jaccard(a.description, b.description);
  const km = haversineKm(a, b);
  const locSim = km <= 0.2 ? 1 : km <= 0.5 ? 0.6 : km <= 1 ? 0.2 : 0;
  const hours = Math.abs(a.at.getTime() - b.at.getTime()) / 3600_000;
  const timeSim = hours <= 6 ? 1 : hours <= 24 ? 0.5 : 0;
  const score = 0.4 * titleSim + 0.2 * descSim + 0.25 * locSim + 0.15 * timeSim;
  return Math.round(score * 1000) / 1000;
}

export interface DuplicateMatch {
  id: string;
  title: string;
  score: number;
}

export function findDuplicates(
  subject: DuplicateSubject,
  others: (DuplicateSubject & { id: string })[],
  threshold = DUPLICATE_THRESHOLD,
): DuplicateMatch[] {
  return others
    .filter((o) => o.id !== subject.id)
    .map((o) => ({ id: o.id, title: o.title, score: duplicateScore(subject, o) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
