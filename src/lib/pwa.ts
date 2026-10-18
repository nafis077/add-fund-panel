export const INSTALL_DISMISS_KEY = "pt-install-dismissed";

export function isStandaloneDisplay(nav: { standalone?: boolean } = {}, mediaMatches = false): boolean {
  return nav.standalone === true || mediaMatches;
}

export function isIosDevice(userAgent: string, platform = "", maxTouchPoints = 0): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isIosSafari(userAgent: string, platform = "", maxTouchPoints = 0): boolean {
  if (!isIosDevice(userAgent, platform, maxTouchPoints)) return false;
  return !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(userAgent);
}

export function shouldPromptIosInstall(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  mediaMatches?: boolean;
  dismissed?: boolean;
}): boolean {
  if (input.dismissed) return false;
  if (isStandaloneDisplay({ standalone: input.standalone }, input.mediaMatches)) return false;
  return isIosSafari(input.userAgent, input.platform ?? "", input.maxTouchPoints ?? 0);
}

export function themeColorFor(theme: "light" | "dark"): string {
  return theme === "light" ? "#f3f6fb" : "#070b14";
}
