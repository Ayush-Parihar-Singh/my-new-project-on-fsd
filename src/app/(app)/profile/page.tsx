import { requirePageUser } from "@/server/auth/guards";
import { findUserById } from "@/server/repositories/users.repo";
import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { VERIFICATION_LABELS, ROLE_LABELS } from "@/lib/constants";
import { DEFAULT_MAP_CENTER } from "@/lib/geo-defaults";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser();
  const { welcome } = await searchParams;
  const full = await findUserById(user.id);
  const org = full?.organization ?? null;
  const vp = full?.volunteerProfile ?? null;
  const isWelcome = welcome === "1" || !user.onboardedAt;
  const role = user.role === "ADMIN" ? null : user.role;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow={welcome === "1" ? "Welcome to LastPlate" : "Account"}
        title={welcome === "1" ? "Tell us about your work" : "Profile"}
        description={welcome === "1" ? "A few details let us match food to the right people. It takes about three minutes." : "Your organization or volunteer details, and where you are verified."}
        actions={<Badge tone={user.verificationStatus === "VERIFIED" ? "forest" : "amber"}>{VERIFICATION_LABELS[user.verificationStatus]}</Badge>}
      />
      <p className="text-sm text-muted">Signed in as <span className="font-semibold text-deep">{user.fullName}</span> · {ROLE_LABELS[user.role]}</p>
      {user.verificationStatus === "PENDING" ? <Alert tone="info" title="Under review">Our team usually reviews new organizations within two working days. You will get a notification when the decision is made.</Alert> : null}
      {user.verificationStatus === "REJECTED" ? <Alert tone="error" title="Not verified yet">Update your details below and save to send a new request. The reviewer note is in your notifications.</Alert> : null}
      {role ? (
        <ProfileForm
          role={role}
          welcome={isWelcome}
          defaultCenter={org ? [org.latitude, org.longitude] : vp ? [vp.latitude, vp.longitude] : DEFAULT_MAP_CENTER}
          initialOrg={org ? { ...org, kind: "ORGANIZATION", registrationNumber: org.registrationNumber ?? "", description: org.description ?? "", operatingHours: org.operatingHours ?? "", applicantNote: "" } as never : null}
          initialVolunteer={vp ? { ...vp, kind: "VOLUNTEER", applicantNote: "" } as never : null}
        />
      ) : (
        <Alert tone="info">Admin accounts do not need a public profile.</Alert>
      )}
    </div>
  );
}
