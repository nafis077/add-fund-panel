"use client";

import { ChevronDown } from "lucide-react";
import { useActivePanel } from "@/components/active-panel-provider";

export function PanelSwitcher({ compact = false }: { compact?: boolean }) {
  const { panels, activePanelId, activePanel, ready, setActivePanelId } = useActivePanel();
  const usable = panels.filter((panel) => panel.isActive);
  const options = usable.length ? usable : panels;

  if (!ready) {
    return <p className="muted text-sm">Loading panels…</p>;
  }

  if (options.length === 0) {
    return <p className="muted text-sm">No panels yet</p>;
  }

  return (
    <label className={`panel-switcher ${compact ? "panel-switcher-compact" : ""}`}>
      <span className="sr-only">Switch panel</span>
      <select
        className="panel-switcher-select"
        value={activePanelId}
        onChange={(event) => setActivePanelId(event.target.value)}
        aria-label="Switch panel"
      >
        {options.map((panel) => (
          <option key={panel.id} value={panel.id}>
            {panel.name}
            {panel.isDefault ? " · default" : ""}
          </option>
        ))}
      </select>
      <span className="panel-switcher-face">
        <span className="panel-switcher-copy">
          {!compact ? <span className="panel-switcher-kicker">Working on</span> : null}
          <span className="panel-switcher-name">
            {activePanel ? `${activePanel.name}${activePanel.currency ? ` · ${activePanel.currency}` : ""}` : "Select panel"}
          </span>
        </span>
        <ChevronDown size={16} />
      </span>
    </label>
  );
}
