import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth/guards";
import { findUserById } from "@/server/repositories/users.repo";
import { DEFAULT_MAP_CENTER } from "@/lib/geo-defaults";
import { DonationWizard } from "@/components/donations/donation-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { emptyDonationValues } from "@/lib/donation-form";

export const metadata = { title: "Post a donation" };

export default async function NewDonationPage() {
  const user = await requirePageUser(["DONOR"]);
  if (!user.onboardedAt) redirect("/profile?welcome=1");
  const full = await findUserById(user.id);
  const org = full?.organization;
  const center: [number, number] = org ? [org.latitude, org.longitude] : DEFAULT_MAP_CENTER;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="New donation" title="Post surplus food" description="Three short steps. Save a draft at any time and publish when it is ready." />
      {user.verificationStatus !== "VERIFIED" ? (
        <Alert tone="warning" title="Verification needed to publish">You can prepare the listing now. Publishing unlocks once an admin verifies your organization.</Alert>
      ) : null}
      <DonationWizard mode="create" initialValues={emptyDonationValues()} initialPhotos={[]} defaultCenter={center} />
    </div>
  );
}
