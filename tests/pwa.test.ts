import { describe, expect, it } from "vitest";
import { biometricLabel, isIosDevice, isIosSafari, isStandaloneDisplay, shouldPromptIosInstall, themeColorFor } from "@/lib/pwa";
import { isPublicPath } from "@/lib/public-paths";

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
    expect(biometricLabel("Mozilla/5.0 (iPhone)")).toBe("Unlock with Face ID");
  });

  it("lets iPhone fetch the PWA files without a session", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/apple-icon")).toBe(true);
    expect(isPublicPath("/icon")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/funds")).toBe(false);
  });
});
