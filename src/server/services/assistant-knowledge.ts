// Platform rules and a deterministic FAQ used when no AI model is configured.
export const ASSISTANT_RULES = [
  "Donations move through: DRAFT -> AVAILABLE -> REQUESTED (a recipient claims) -> CONFIRMED (donor confirms) -> PICKUP_IN_PROGRESS (volunteer accepts) -> COMPLETED (volunteer hands over with the 4-digit code).",
  "Only one recipient can claim a donation. Claims are first-come, first-served and locked at the database level.",
  "Donors must be verified by an admin before publishing. Recipients and volunteers must be verified before claiming or accepting tasks.",
  "Pickup addresses and phone numbers are shared only with the parties in an active handover.",
  "The recipient sees the 4-digit handover code. The volunteer enters it on delivery to complete the handover.",
  "Listings with no claim expire at the pickup deadline. Confirmed pickups that miss the deadline are marked as failed handovers.",
  "Donors can edit a listing until it is claimed, and cancel until a volunteer starts the pickup.",
  "LastPlate cannot determine food safety, freshness or edibility from photos. Donors and volunteers must check food themselves.",
].join("\n");

interface Entry {
  keywords: string[];
  answer: string;
  links?: { label: string; href: string }[];
  roles?: string[];
}

const ENTRIES: Entry[] = [
  { keywords: ["post", "list", "donate", "publish", "donation"], answer: "To share surplus food, open the donation form, add the details, pin the pickup point and publish. Your organization must be verified first.", links: [{ label: "Post a donation", href: "/donations/new" }], roles: ["DONOR", "GUEST"] },
  { keywords: ["claim", "request", "reserve", "take"], answer: "Recipients can claim available donations that match their dietary and allergen requirements. The donor then confirms the claim before pickup is arranged.", links: [{ label: "Find food near me", href: "/discover" }], roles: ["NGO", "GUEST"] },
  { keywords: ["code", "handover", "deliver", "complete"], answer: "When a volunteer arrives with the food, the recipient reads the 4-digit handover code from their donation page and the volunteer enters it to complete the handover.", links: [{ label: "Your donations", href: "/donations" }] },
  { keywords: ["volunteer", "pickup", "task", "deliver", "transport"], answer: "Volunteers accept nearby pickup tasks, collect the food, then deliver it and enter the recipient's handover code. Set your availability in settings.", links: [{ label: "Delivery board", href: "/deliveries" }], roles: ["VOLUNTEER", "GUEST"] },
  { keywords: ["verify", "verification", "approve", "approved", "verified"], answer: "After you complete onboarding, an admin reviews your organization or volunteer details. You will get a notification when the decision is made.", links: [{ label: "Settings", href: "/settings" }] },
  { keywords: ["expire", "expired", "deadline", "late", "missed"], answer: "Every listing has a pickup deadline. Unclaimed listings expire at the deadline. Confirmed pickups that miss the deadline are recorded as failed handovers, and everyone involved is notified." },
  { keywords: ["cancel", "cancellation", "withdraw"], answer: "Donors can cancel until a volunteer starts the pickup. Recipients can withdraw a claim before a volunteer is on the way. Cancellations are notified to the other parties." },
  { keywords: ["safe", "safety", "fresh", "edible", "spoiled", "photo", "expiry"], answer: "LastPlate cannot tell whether food is safe, fresh or edible from a photo or description. Donors should describe preparation and storage honestly, and recipients should inspect food before serving." },
  { keywords: ["address", "phone", "privacy", "private", "contact", "location"], answer: "Public listings show a neighbourhood and an approximate map point. Exact addresses and phone numbers are shared only with the parties in an active handover." },
  { keywords: ["password", "login", "sign", "reset", "account"], answer: "If you forgot your password, use 'Forgot password' on the sign-in page. The reset link works once and expires after 30 minutes.", links: [{ label: "Sign in", href: "/login" }] },
];

export function assistantKnowledge(message: string, role: string): { answer: string; links: { label: string; href: string }[] } {
  const words = message.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let best: { entry: Entry; hits: number } | null = null;
  for (const entry of ENTRIES) {
    if (entry.roles && !entry.roles.includes(role)) continue;
    const hits = entry.keywords.filter((k) => words.some((w) => w.startsWith(k))).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { entry, hits };
  }
  if (best) return { answer: best.entry.answer, links: best.entry.links ?? [] };
  return {
    answer: "I can explain how donations move through LastPlate, how claims and handovers work, verification, privacy, and cancellations. Try asking about one of those topics.",
    links: [{ label: "How it works", href: "/#how-it-works" }],
  };
}
