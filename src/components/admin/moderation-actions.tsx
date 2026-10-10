"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/client/api";

type Action = "REJECT_LISTING" | "DISMISS_DUPLICATE_FLAG" | "RESOLVE_REPORT" | "DISMISS_REPORT";

/** Each moderation action is recorded in the audit log by the server. `targetId` is a donation id, or a report id for report actions. */
export function ModerationAction({ targetId, action, label, variant = "outline", needsReason = true, reasonHint }: { targetId: string; action: Action; label: string; variant?: "outline" | "danger" | "primary"; needsReason?: boolean; reasonHint?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const valid = reason.trim().length >= 3;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api("POST", `/api/admin/moderation/${targetId}`, { action, reason: reason.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) return <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="w-full space-y-2 rounded-xl border border-line bg-cream p-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {needsReason ? (
        <Field id={`mod-${targetId}-${action}`} label="Note for the audit log" hint={reasonHint}>
          <Input id={`mod-${targetId}-${action}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} describedBy={describedBy(`mod-${targetId}-${action}`, "m")} />
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" variant={variant === "outline" ? "primary" : variant} loading={busy} disabled={!valid} onClick={submit}>{label}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
