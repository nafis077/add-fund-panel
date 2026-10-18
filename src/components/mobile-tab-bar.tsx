"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  History,
  Layers3,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  ScrollText,
  Server,
  Settings,
  Table2,
  Wallet,
} from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/funds", label: "Funds", icon: Wallet },
  { href: "/history", label: "History", icon: History },
  { href: "/panels", label: "Panels", icon: Server },
] as const;

const MORE_LINKS = [
  { href: "/funds/bulk", label: "Bulk Distribution", icon: Table2 },
  { href: "/logs", label: "Activity Log", icon: ScrollText },
  { href: "/batches", label: "Batch History", icon: Layers3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function pathActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_LINKS.some((link) => pathActive(pathname, link.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.assign("/login");
  }

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close more menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      {moreOpen ? (
        <div className="card fixed inset-x-3 z-50 p-2 md:hidden" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}>
          {MORE_LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMoreOpen(false)}
                className={`nav-link ${active ? "nav-link-on" : ""}`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300" onClick={() => void logout()}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      ) : null}
      <nav className="mobile-tab-bar md:hidden" aria-label="App tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === "/funds" ? pathname === "/funds" : pathActive(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={active ? "tab-active" : "tab-idle"} onClick={() => setMoreOpen(false)}>
              <Icon size={22} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button type="button" className={moreActive || moreOpen ? "tab-active" : "tab-idle"} onClick={() => setMoreOpen((open) => !open)}>
          <MoreHorizontal size={22} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
