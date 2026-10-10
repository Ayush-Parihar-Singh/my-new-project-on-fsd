"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea, describedBy } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/client/api";

export function VerificationDecision({ requestId, orgName }: { requestId: string; orgName: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "APPROVE" | "REJECT">(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    const res = await api("POST", `/api/admin/verifications/${requestId}`, { decision, note: note.trim() || null });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setMode(null);
    setNote("");
    router.refresh();
  }

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setMode("APPROVE")} aria-label={`Approve ${orgName}`}><Check /> Approve</Button>
        <Button size="sm" variant="outline" onClick={() => setMode("REJECT")} aria-label={`Reject ${orgName}`}><X /> Reject</Button>
      </div>
    );
  }
  const needsNote = mode === "REJECT";
  const noteError = needsNote && note.trim().length < 5 ? ["Explain why, in at least 5 characters. The applicant sees this."] : undefined;
  return (
    <div className="w-full space-y-3 rounded-2xl border border-line bg-cream p-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field id={`note-${requestId}`} label={needsNote ? "Reason for rejecting" : "Note (optional)"} error={noteError} hint={needsNote ? undefined : "Stored in the audit log"}>
        <Textarea id={`note-${requestId}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} invalid={!!noteError} describedBy={describedBy(`note-${requestId}`, undefined, noteError)} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "APPROVE" ? "primary" : "danger"} loading={busy} disabled={needsNote && note.trim().length < 5} onClick={() => decide(mode)}>
          Confirm {mode === "APPROVE" ? "approval" : "rejection"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
      </div>
    </div>
  );
}
