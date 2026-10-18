"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { pickDefaultPanelId, persistPanelId, readStoredPanelId, type SwitchablePanel } from "@/lib/active-panel";

type ActivePanelContextValue = {
  panels: SwitchablePanel[];
  activePanelId: string;
  activePanel: SwitchablePanel | null;
  ready: boolean;
  setActivePanelId: (id: string) => void;
};

const ActivePanelContext = createContext<ActivePanelContextValue | null>(null);

export function ActivePanelProvider({ children }: { children: React.ReactNode }) {
  const [panels, setPanels] = useState<SwitchablePanel[]>([]);
  const [activePanelId, setActivePanelIdState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void api<{ panels: SwitchablePanel[] }>("/api/panels")
      .then((payload) => {
        setPanels(payload.panels);
        const next = pickDefaultPanelId(payload.panels, readStoredPanelId());
        setActivePanelIdState(next);
        if (next) persistPanelId(next);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<ActivePanelContextValue>(
    () => ({
      panels,
      activePanelId,
      activePanel: panels.find((panel) => panel.id === activePanelId) ?? null,
      ready,
      setActivePanelId: (id) => {
        setActivePanelIdState(id);
        persistPanelId(id);
      },
    }),
    [panels, activePanelId, ready],
  );

  return <ActivePanelContext.Provider value={value}>{children}</ActivePanelContext.Provider>;
}

export function useActivePanel() {
  const context = useContext(ActivePanelContext);
  if (!context) {
    throw new Error("useActivePanel must be used within ActivePanelProvider");
  }
  return context;
}
