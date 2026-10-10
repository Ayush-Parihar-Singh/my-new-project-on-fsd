import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-neutral-100 text-neutral-700",
      sage: "bg-sage text-deep",
      forest: "bg-forest text-white",
      amber: "bg-amber-100 text-amber-900",
      coral: "bg-coral-soft text-coral-ink",
      danger: "bg-red-50 text-destructive",
      demo: "border border-dashed border-forest/40 bg-white text-forest",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
