import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar user={session} />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="border-b border-white/10 md:hidden">
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Panel Treasury</p>
              <p className="text-sm text-slate-400">{session.name}</p>
            </div>
            <ThemeToggle compact />
          </div>
          <MobileNav />
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
