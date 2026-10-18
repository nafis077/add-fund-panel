import { describe, expect, it } from "vitest";
import { pickDefaultPanelId, type SwitchablePanel } from "@/lib/active-panel";

const panels: SwitchablePanel[] = [
  { id: "a", name: "Alpha", currency: "USD", isActive: true, isDefault: false, connectionStatus: "CONNECTED" },
  { id: "b", name: "Beta", currency: "USD", isActive: true, isDefault: true, connectionStatus: "CONNECTED" },
  { id: "c", name: "Off", currency: "USD", isActive: false, isDefault: false, connectionStatus: "FAILED" },
];

describe("active panel picker", () => {
  it("prefers the stored panel when it is still active", () => {
    expect(pickDefaultPanelId(panels, "a")).toBe("a");
  });

  it("falls back to the default panel, then the first active panel", () => {
    expect(pickDefaultPanelId(panels, "missing")).toBe("b");
    expect(pickDefaultPanelId(panels.filter((panel) => !panel.isDefault), null)).toBe("a");
  });
});
