export const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
export const PUBLIC_ASSETS = ["/manifest.webmanifest", "/sw.js", "/icon", "/apple-icon"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname === path)) return true;
  if (pathname.startsWith("/_next")) return true;
  return PUBLIC_ASSETS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
