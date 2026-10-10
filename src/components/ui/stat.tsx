import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon, tone = "sage", className }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: "sage" | "coral" | "forest" | "cream"; className?: string }) {
  const toneCls = {
    sage: "bg-sage text-deep",
    coral: "bg-coral-soft text-coral-ink",
    forest: "bg-forest text-white",
    cream: "bg-white text-deep",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-line p-5 shadow-card", tone === "cream" ? "bg-white" : "", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <span className={cn("flex size-9 items-center justify-center rounded-full [&_svg]:size-4", toneCls)}>{icon}</span> : null}
      </div>
      <p className="font-display text-3xl font-extrabold text-deep tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
