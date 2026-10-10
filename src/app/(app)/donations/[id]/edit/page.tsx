import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/guards";
import { getDonationForViewer } from "@/server/services/donation.service";
import { DonationWizard } from "@/components/donations/donation-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { donationToFormValues } from "@/lib/donation-form";
import { findUserById } from "@/server/repositories/users.repo";
import { DEFAULT_MAP_CENTER } from "@/lib/geo-defaults";
import { NotFoundError } from "@/lib/errors";

export const metadata = { title: "Edit donation" };

export default async function EditDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["DONOR"]);
  const { id } = await params;
  let d;
  try {
    d = await getDonationForViewer(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (d.access !== "FULL") notFound();
  const full = await findUserById(user.id);
  const center: [number, number] = full?.organization ? [full.organization.latitude, full.organization.longitude] : DEFAULT_MAP_CENTER;
  const editable = ["DRAFT", "AVAILABLE", "REQUESTED"].includes(d.status);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Edit donation" title={d.title} description={`Status: ${d.status.toLowerCase().replaceAll("_", " ")}`} />
      {!editable ? (
        <Alert tone="warning" title="This listing can no longer be edited">Once a volunteer is collecting the food, details are locked to keep the handover accurate.</Alert>
      ) : null}
      {editable ? (
        <DonationWizard
          mode="edit"
          donationId={d.id}
          initialValues={donationToFormValues(d)}
          initialPhotos={d.photos}
          initialStatus={d.status}
          defaultCenter={center}
        />
      ) : null}
    </div>
  );
}
