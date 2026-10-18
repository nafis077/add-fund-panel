"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { PanelSwitcher } from "@/components/panel-switcher";

export function AppTopBar({ userName }: { userName: string }) {
  return (
    <header className="app-top-bar">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Panel Treasury</p>
        <p className="truncate text-sm text-slate-400">{userName}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-md">
        <PanelSwitcher />
        <ThemeToggle compact />
      </div>
    </header>
  );
}
