import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/guards";
import { discoverDonations } from "@/server/services/discovery.service";
import { discoverQuerySchema } from "@/validation/operations";
import { DiscoverClient, type Viewer } from "@/components/discover/discover-client";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Find food near me",
  description: "Browse open surplus food near you. Pickup areas are approximate until a handover is confirmed.",
};
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const query = discoverQuerySchema.parse({ sort: user?.role === "NGO" && user.verificationStatus === "VERIFIED" ? "best" : "deadline", pageSize: 24 });
  const data = await discoverDonations(user, query);
  const viewer: Viewer | null = user && (user.role === "DONOR" || user.role === "NGO" || user.role === "VOLUNTEER" || user.role === "ADMIN")
    ? { role: user.role, verified: user.verificationStatus === "VERIFIED" }
    : null;
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-8">
      <PageHeader
        eyebrow="Discover"
        title="Find food near me"
        description="Open surplus food, closest deadlines first. Verified recipients see matches for their organization and can request food in one tap."
        actions={!user ? <ButtonLink href="/register?role=NGO" variant="secondary">Register your organization</ButtonLink> : null}
      />
      <DiscoverClient viewer={viewer} initialItems={data.items} />
    </div>
  );
}
