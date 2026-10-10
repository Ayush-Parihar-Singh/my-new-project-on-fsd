import { requirePageUser } from "@/server/auth/guards";
import { volunteerBoard } from "@/server/services/delivery.service";
import { DeliveryBoard, type BoardData } from "@/components/deliveries/delivery-board";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Deliveries" };
export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const user = await requirePageUser(["VOLUNTEER"]);
  const board = await volunteerBoard(user);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Volunteer"
        title="Deliveries"
        description="Pick up surplus food from donors and carry it to recipients. Exact addresses appear once you accept a task."
      />
      <DeliveryBoard initial={board as unknown as BoardData} />
    </div>
  );
}
