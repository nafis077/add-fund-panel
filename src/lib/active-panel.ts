export const ACTIVE_PANEL_KEY = "pt-active-panel";

export type SwitchablePanel = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
};

export function readStoredPanelId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PANEL_KEY);
}

export function persistPanelId(id: string) {
  window.localStorage.setItem(ACTIVE_PANEL_KEY, id);
}

export function pickDefaultPanelId(panels: SwitchablePanel[], stored?: string | null): string {
  const usable = panels.filter((panel) => panel.isActive);
  const pool = usable.length ? usable : panels;
  if (stored && pool.some((panel) => panel.id === stored)) return stored;
  return pool.find((panel) => panel.isDefault)?.id ?? pool[0]?.id ?? "";
}
