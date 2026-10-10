import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, children, action, className }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed border-forest/25 bg-white/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="flex size-12 items-center justify-center rounded-full bg-sage text-forest [&_svg]:size-6">{icon}</div> : null}
      <p className="font-display text-lg font-bold text-deep">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
