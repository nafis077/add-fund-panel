import { describe, expect, it } from "vitest";
import { isIosDevice, isIosSafari, isStandaloneDisplay, shouldPromptIosInstall, themeColorFor } from "@/lib/pwa";

describe("pwa install helpers", () => {
  it("detects iPhone Safari and iPad desktop-mode", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0", "MacIntel", 5)).toBe(true);
    expect(isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(true);
    expect(isIosSafari("Mozilla/5.0 (iPhone) CriOS/120.0.0.0")).toBe(false);
  });

  it("hides the prompt after install or dismiss", () => {
    expect(isStandaloneDisplay({ standalone: true })).toBe(true);
    expect(
      shouldPromptIosInstall({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        dismissed: false,
      }),
    ).toBe(true);
    expect(
      shouldPromptIosInstall({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        standalone: true,
      }),
    ).toBe(false);
    expect(themeColorFor("dark")).toBe("#070b14");
  });
});
