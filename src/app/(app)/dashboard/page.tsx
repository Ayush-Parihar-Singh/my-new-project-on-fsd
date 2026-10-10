import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth/guards";
import { DonorDashboard } from "@/components/dashboards/donor-dashboard";
import { NgoDashboard } from "@/components/dashboards/ngo-dashboard";
import { VolunteerDashboard } from "@/components/dashboards/volunteer-dashboard";
import { AdminOverview } from "@/components/dashboards/admin-overview";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  if (user.role !== "ADMIN" && !user.onboardedAt) redirect("/profile?welcome=1");
  switch (user.role) {
    case "DONOR":
      return <DonorDashboard user={user} />;
    case "NGO":
      return <NgoDashboard user={user} />;
    case "VOLUNTEER":
      return <VolunteerDashboard user={user} />;
    case "ADMIN":
      return <AdminOverview />;
  }
}
