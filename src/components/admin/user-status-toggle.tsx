"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/client/api";

export function UserStatusToggle({ userId, name, status }: { userId: string; name: string; status: "ACTIVE" | "SUSPENDED" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  const reasonError = reason.trim().length > 0 && reason.trim().length < 3 ? ["Give a short reason (at least 3 characters)."] : undefined;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api("PATCH", `/api/admin/users/${userId}`, { status: next, reason: reason.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" variant={next === "SUSPENDED" ? "danger" : "outline"} onClick={() => setOpen(true)} aria-label={`${next === "SUSPENDED" ? "Suspend" : "Reactivate"} ${name}`}>
        {next === "SUSPENDED" ? "Suspend" : "Reactivate"}
      </Button>
    );
  }
  return (
    <div className="w-full space-y-3 rounded-xl border border-line bg-cream p-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field id={`reason-${userId}`} label={`Reason for ${next === "SUSPENDED" ? "suspending" : "reactivating"} ${name}`} required error={reasonError} hint="Recorded in the audit log. Suspending ends all of their sessions.">
        <Input id={`reason-${userId}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} invalid={!!reasonError} describedBy={describedBy(`reason-${userId}`, "h", reasonError)} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" variant={next === "SUSPENDED" ? "danger" : "primary"} loading={busy} disabled={reason.trim().length < 3} onClick={submit}>Confirm</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
