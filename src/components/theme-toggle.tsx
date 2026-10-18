"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({
  compact = false,
  className = "btn-secondary",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Day mode" : "Night mode";

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextLabel.toLowerCase()}`}
      title={nextLabel}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {compact ? <span className="sr-only">{nextLabel}</span> : nextLabel}
    </button>
  );
}
