"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Flag, HandHeart, Pencil, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea, Field, describedBy } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import type { DonationView } from "@/domain/visibility";

interface Props {
  donation: DonationView;
  role: "DONOR" | "NGO" | "VOLUNTEER" | "ADMIN" | null;
  viewerId: string | null;
  viewerVerified: boolean;
  isOwner: boolean;
  isClaimant: boolean;
}

type Busy = null | "publish" | "claim" | "withdraw" | "confirm" | "decline" | "cancel" | "report";

/** Every action here calls a Route Handler that re-checks authorization and state on the server. */
export function DonationActions({ donation: d, role, viewerVerified, isOwner, isClaimant }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Busy>(null);
  const [notice, setNotice] = React.useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [duplicate, setDuplicate] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [panel, setPanel] = React.useState<null | "cancel" | "decline" | "withdraw" | "report">(null);
  const [reportText, setReportText] = React.useState("");

  async function run<T>(kind: Busy, url: string, body: unknown | undefined, onOk: string) {
    setBusy(kind);
    setNotice(null);
    const res = await api<T>("POST", url, body);
    setBusy(null);
    if (!res.ok) {
      if (res.code === "DUPLICATE_SUSPECTED") setDuplicate(res.message);
      setNotice({ tone: "error", text: res.message });
      return false;
    }
    setNotice({ tone: "success", text: onOk });
    setPanel(null);
    router.refresh();
    return true;
  }

  const status = d.status;
  const canEdit = isOwner && (status === "DRAFT" || status === "AVAILABLE" || status === "REQUESTED");
  const canCancel = isOwner && ["DRAFT", "AVAILABLE", "REQUESTED", "CONFIRMED"].includes(status);
  const canClaim = role === "NGO" && viewerVerified && status === "AVAILABLE" && !isOwner;
  const canWithdraw = isClaimant && (status === "REQUESTED" || status === "CONFIRMED");
  const canConfirm = isOwner && status === "REQUESTED";
  const canReport = !!role && (role === "NGO" || role === "VOLUNTEER") && !isOwner && ["AVAILABLE", "REQUESTED", "CONFIRMED", "PICKUP_IN_PROGRESS"].includes(status) && !isClaimant;

  const hasAny = canEdit || canCancel || canClaim || canWithdraw || canConfirm || canReport || (isOwner && status === "DRAFT");

  return (
    <Card className="space-y-0">
      <CardHeader>
        <CardTitle as="h2">Actions</CardTitle>
        <CardDescription>
          {isOwner ? "Manage your listing and the claims on it." : isClaimant ? "Your request for this donation." : role === "NGO" ? "Claim food your organization can use." : "Choose what you would like to do."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? <Alert tone={notice.tone === "error" ? "error" : notice.tone === "success" ? "success" : "warning"}>{notice.text}</Alert> : null}
        {duplicate ? (
          <Alert tone="warning" title="Possible repost">
            <p>{duplicate}</p>
            <Button size="sm" variant="coral" className="mt-3" loading={busy === "publish"} onClick={() => run<unknown>("publish", `/api/donations/${d.id}/publish`, { acknowledgeDuplicate: true }, "Published. The listing is flagged for moderation review.")}>
              Publish anyway
            </Button>
          </Alert>
        ) : null}

        {!hasAny ? <p className="text-sm text-muted">No actions are available at this stage.</p> : null}

        <div className="flex flex-wrap gap-2">
          {isOwner && status === "DRAFT" ? (
            <Button loading={busy === "publish"} onClick={() => run<unknown>("publish", `/api/donations/${d.id}/publish`, { acknowledgeDuplicate: false }, "Published. Verified recipients can now see it.")}>
              <CheckCircle2 /> Publish donation
            </Button>
          ) : null}
          {canEdit ? (
            <Link href={`/donations/${d.id}/edit`} className="inline-flex h-11 items-center gap-2 rounded-full border border-forest/30 bg-white px-5 text-sm font-semibold text-forest hover:border-forest hover:bg-forest-50">
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          ) : null}
          {canConfirm ? (
            <Button loading={busy === "confirm"} onClick={() => run<unknown>("confirm", `/api/donations/${d.id}/claim/confirm`, {}, "Confirmed. The recipient has been notified and a volunteer can now collect the food.")}>
              <CheckCircle2 /> Confirm claim
            </Button>
          ) : null}
          {canConfirm ? (
            <Button variant="outline" onClick={() => setPanel(panel === "decline" ? null : "decline")} aria-expanded={panel === "decline"}>
              <XCircle /> Decline request
            </Button>
          ) : null}
          {canClaim ? (
            <Button loading={busy === "claim"} onClick={() => run<unknown>("claim", `/api/donations/${d.id}/claim`, undefined, "Request sent. The donor will confirm the pickup shortly.")}>
              <HandHeart /> Claim this donation
            </Button>
          ) : null}
          {canWithdraw ? (
            <Button variant="outline" onClick={() => setPanel(panel === "withdraw" ? null : "withdraw")} aria-expanded={panel === "withdraw"}>
              <Undo2 /> Withdraw request
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setPanel(panel === "cancel" ? null : "cancel")} aria-expanded={panel === "cancel"}>
              <XCircle /> Cancel donation
            </Button>
          ) : null}
          {canReport ? (
            <Button variant="ghost" onClick={() => setPanel(panel === "report" ? null : "report")} aria-expanded={panel === "report"}>
              <Flag /> Report listing
            </Button>
          ) : null}
        </div>

        {panel === "cancel" || panel === "decline" || panel === "withdraw" ? (
          <form
            className="space-y-3 rounded-2xl border border-line bg-cream p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (panel === "cancel") run<unknown>("cancel", `/api/donations/${d.id}/cancel`, { reason }, "Donation cancelled. Anyone involved has been notified.");
              if (panel === "decline") run<unknown>("decline", `/api/donations/${d.id}/claim/decline`, { reason }, "Request declined. The donation is open again.");
              if (panel === "withdraw") run<unknown>("withdraw", `/api/donations/${d.id}/claim/withdraw`, { reason }, "Your request was withdrawn.");
            }}
          >
            <Field id="reason" label={panel === "cancel" ? "Why are you cancelling?" : panel === "decline" ? "Reason for declining (optional)" : "Reason (optional)"} hint="Shared with the other parties as a short note.">
              <Input id="reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} describedBy={describedBy("reason", "r")} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant={panel === "cancel" ? "danger" : "primary"} size="sm" loading={busy === panel} disabled={panel === "cancel" && reason.trim().length < 3}>
                Confirm {panel}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)}>Keep it</Button>
            </div>
          </form>
        ) : null}

        {panel === "report" ? (
          <form
            className="space-y-3 rounded-2xl border border-line bg-cream p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run<unknown>("report", `/api/donations/${d.id}/report`, { reason: reportText }, "Thanks. An administrator will review this listing.");
            }}
          >
            <Field id="report" label="What looks wrong?" hint="At least 10 characters. Describe the problem, not the people involved.">
              <Textarea id="report" rows={3} maxLength={500} value={reportText} onChange={(e) => setReportText(e.target.value)} />
            </Field>
            <Button type="submit" size="sm" variant="outline" loading={busy === "report"} disabled={reportText.trim().length < 10}>Send report</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
