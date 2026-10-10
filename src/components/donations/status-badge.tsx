import { Badge } from "@/components/ui/badge";
import { DONATION_STATUS_LABELS, DONATION_STATUS_TONE } from "@/lib/constants";
import type { DonationStatus } from "@/generated/prisma/enums";

export function StatusBadge({ status }: { status: DonationStatus }) {
  const tone = DONATION_STATUS_TONE[status];
  const map = { neutral: "neutral", sage: "sage", amber: "amber", forest: "forest", coral: "coral", danger: "danger" } as const;
  return <Badge tone={map[tone]}>{DONATION_STATUS_LABELS[status]}</Badge>;
}
