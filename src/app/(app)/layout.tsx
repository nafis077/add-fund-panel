import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ActivePanelProvider } from "@/components/active-panel-provider";
import { AppTopBar } from "@/components/app-top-bar";
import { FaceLockGate } from "@/components/face-lock-gate";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PersistenceWarning } from "@/components/persistence-warning";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <FaceLockGate>
      <ActivePanelProvider>
        <div className="app-shell">
          <div className="hidden md:block">
            <Sidebar user={session} />
          </div>
          <div className="flex min-h-dvh flex-1 flex-col">
            <AppTopBar userName={session.name} />
            <main className="mobile-app-main flex-1 p-4 md:p-8">
              <PersistenceWarning />
              <div className="mb-4 md:hidden">
                <InstallAppPrompt compact />
              </div>
              {children}
            </main>
            <MobileTabBar />
          </div>
        </div>
      </ActivePanelProvider>
    </FaceLockGate>
  );
}
