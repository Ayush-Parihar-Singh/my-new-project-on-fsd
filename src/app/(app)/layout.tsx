import { requirePageUser } from "@/server/auth/guards";
import { unreadCount } from "@/server/services/notification.service";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { navFor, ROLE_HOME_LABEL } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const unread = await unreadCount(user.id);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <AppSidebar items={navFor(user.role)} userName={user.fullName} roleLabel={ROLE_HOME_LABEL[user.role]} unread={unread} />
      <main id="main" className="min-w-0 px-4 pb-24 pt-6 md:px-10 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <AssistantWidget />
    </div>
  );
}
