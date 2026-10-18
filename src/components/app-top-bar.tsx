"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { PanelSwitcher } from "@/components/panel-switcher";

export function AppTopBar({ userName }: { userName: string }) {
  return (
    <header className="app-top-bar">
      <div className="app-top-bar-brand">
        <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Panel Treasury</p>
        <p className="truncate text-sm text-slate-400">{userName}</p>
      </div>
      <PanelSwitcher />
      <div className="app-top-bar-tools">
        <ThemeToggle compact />
      </div>
    </header>
  );
}
