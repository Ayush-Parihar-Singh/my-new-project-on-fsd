import { Clock, HandHeart, ListChecks, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Props {
  completedHandovers: number;
  activeListings: number;
  inProgress: number;
  verifiedPartners: number;
  demo: { donations: number; totalDonations: number };
}

/** Real aggregates from PostgreSQL. Demo records are counted separately and disclosed. */
export function ImpactStats({ completedHandovers, activeListings, inProgress, verifiedPartners, demo }: Props) {
  const items = [
    { label: "Completed handovers", value: completedHandovers, icon: HandHeart },
    { label: "Open listings right now", value: activeListings, icon: ListChecks },
    { label: "Pickups in progress", value: inProgress, icon: Clock },
    { label: "Verified partners", value: verifiedPartners, icon: Users },
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <Icon className="size-5 text-forest" aria-hidden />
              <dd className="mt-4 font-display text-3xl font-extrabold text-deep tabular-nums">{formatNumber(item.value)}</dd>
              <dt className="mt-1 text-sm text-muted">{item.label}</dt>
            </div>
          );
        })}
      </dl>
      <p className="text-xs text-muted">
        Live from our database. {formatNumber(demo.donations)} of {formatNumber(demo.totalDonations)} donation records are labelled demo data and are included only where noted.
      </p>
    </div>
  );
}
