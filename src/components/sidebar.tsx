"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Table2,
  History,
  Layers3,
  Server,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";
import { PanelSwitcher } from "@/components/panel-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funds", label: "Add Funds", icon: Wallet },
  { href: "/funds/bulk", label: "Bulk Distribution", icon: Table2 },
  { href: "/history", label: "Payment History", icon: History },
  { href: "/logs", label: "Activity Log", icon: ScrollText },
  { href: "/batches", label: "Batch History", icon: Layers3 },
  { href: "/panels", label: "Panel Management", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.assign("/login");
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/10 bg-ink-900/80 px-4 py-5">
      <div className="mb-8 px-2">
        <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Central ledger</p>
        <h1 className="mt-1 text-xl font-semibold">Panel Treasury</h1>
        <p className="muted mt-1">Multi-panel fund control</p>
        <div className="mt-4">
          <PanelSwitcher />
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mb-3">
        <ThemeToggle className="btn-secondary w-full" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="muted">{user.role.replaceAll("_", " ")}</p>
        <button onClick={() => void logout()} className="btn-secondary mt-3 w-full">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
