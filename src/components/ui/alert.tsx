import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "error";
const tones: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-forest/20 bg-forest-50 text-deep", Icon: Info },
  success: { cls: "border-forest/30 bg-sage-light text-deep", Icon: CheckCircle2 },
  warning: { cls: "border-amber-300 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  error: { cls: "border-red-200 bg-red-50 text-destructive", Icon: XCircle },
};

/** Announced to assistive tech. Errors use role="alert", others use role="status". */
export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: React.ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
