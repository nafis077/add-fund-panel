import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FaceLockGate } from "@/components/face-lock-gate";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PersistenceWarning } from "@/components/persistence-warning";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <FaceLockGate>
    <div className="app-shell">
      <div className="hidden md:block">
        <Sidebar user={session} />
      </div>
      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="mobile-app-header md:hidden">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Panel Treasury</p>
            <p className="text-sm text-slate-400">{session.name}</p>
          </div>
          <ThemeToggle compact />
        </header>
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
    </FaceLockGate>
  );
}
