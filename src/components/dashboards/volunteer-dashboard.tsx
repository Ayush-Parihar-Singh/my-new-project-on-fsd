import Link from "next/link";
import { Route, ShieldAlert, Trophy, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliveryBoard } from "@/components/deliveries/delivery-board";
import { volunteerBoard } from "@/server/services/delivery.service";
import { volunteerDashboardData } from "@/server/services/analytics.service";
import type { AuthUser } from "@/server/auth/session";
import { formatNumber } from "@/lib/utils";
import type { BoardData } from "@/components/deliveries/delivery-board";
import { UNIT_LABELS } from "@/lib/constants";

export async function VolunteerDashboard({ user }: { user: AuthUser }) {
  const [board, stats] = await Promise.all([volunteerBoard(user), volunteerDashboardData(user.id)]);
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Volunteer dashboard"
        title="Thank you for moving food where it matters today."
        description="Accept a nearby pickup, collect the food, then complete the handover with the recipient’s 4-digit code."
        actions={<ButtonLink href="/deliveries" variant="outline"><Truck /> Delivery board</ButtonLink>}
      />
      {!board.profileComplete ? (
        <Alert tone="warning" title="Set up your volunteer profile">
          Add your location, vehicle and service radius on the <Link className="font-semibold underline" href="/profile">profile page</Link> to see tasks near you.
        </Alert>
      ) : null}
      {board.profileComplete && !board.verified ? (
        <Alert tone="warning" title="Verification pending">You can take tasks once an admin verifies your volunteer profile.</Alert>
      ) : null}
      {board.profileComplete && !board.isAvailable ? (
        <Alert tone="info" title="You are marked unavailable">Switch to available on your profile to see and accept new tasks.</Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active tasks" value={formatNumber(stats.active)} hint="Accepted and in progress" icon={<Route />} tone="sage" />
        <StatCard label="Deliveries completed" value={formatNumber(stats.completed)} hint="Handovers you finished" icon={<Trophy />} tone="forest" />
        <StatCard label="Last 30 days" value={formatNumber(stats.completedLast30Days)} hint="Completed in the past month" icon={<Truck />} tone="cream" />
        <StatCard label="Could not complete" value={formatNumber(stats.failed)} hint="Reported failed pickups" icon={<ShieldAlert />} tone="coral" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Food moved by unit</CardTitle>
          <CardDescription>Totals from your completed handovers.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.moved.length === 0 ? <p className="text-sm text-muted">Your totals will appear after your first completed handover.</p> : (
            <ul className="flex flex-wrap gap-3">
              {stats.moved.map((m) => (
                <li key={m.unit} className="rounded-xl bg-sage-light px-4 py-3">
                  <span className="font-display text-2xl font-extrabold text-deep tabular-nums">{formatNumber(m.quantity)}</span>{" "}
                  <span className="text-sm text-muted">{UNIT_LABELS[m.unit as keyof typeof UNIT_LABELS] ?? m.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {board.active.length === 0 && board.available.length === 0 ? (
        <EmptyState icon={<Truck />} title="No tasks right now">New pickups near you appear on the delivery board as soon as a recipient is confirmed.</EmptyState>
      ) : (
        <DeliveryBoard initial={board as unknown as BoardData} />
      )}
    </div>
  );
}
