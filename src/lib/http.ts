import { NextResponse } from "next/server";
import { AuthError } from "@/lib/permissions";
import { ZodError } from "zod";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    return json({ error: error.issues[0]?.message ?? "Invalid request" }, 400);
  }
  if (error instanceof Error) {
    return json({ error: error.message }, 400);
  }
  return json({ error: "Unexpected server error" }, 500);
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    const port = url.port;
    const implicit =
      (protocol === "https:" && (port === "" || port === "443")) ||
      (protocol === "http:" && (port === "" || port === "80"));
    return implicit ? `${protocol}//${hostname}` : `${protocol}//${hostname}:${port}`;
  } catch {
    return null;
  }
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
  if (!value) return;
  const normalized = value.includes("://") ? normalizeOrigin(value) : normalizeOrigin(`https://${value}`);
  if (normalized) origins.add(normalized);
  if (normalized?.startsWith("http://")) {
    origins.add(normalized.replace("http://", "https://"));
  }
}

export function allowedOriginsForRequest(request: Request, env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set<string>();
  addOrigin(origins, request.url);

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = firstHeaderValue(request.headers.get("host"));
  const proto = firstHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
  for (const hostname of [forwardedHost, host]) {
    if (!hostname) continue;
    addOrigin(origins, `${proto}://${hostname}`);
    addOrigin(origins, `https://${hostname}`);
  }

  addOrigin(origins, env.RAILWAY_PUBLIC_DOMAIN);
  addOrigin(origins, env.RAILWAY_STATIC_URL);
  addOrigin(origins, env.NEXT_PUBLIC_APP_URL);
  addOrigin(origins, env.APP_URL);
  for (const extra of (env.ALLOWED_ORIGINS ?? "").split(",")) {
    addOrigin(origins, extra.trim());
  }

  return [...origins];
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const incoming = normalizeOrigin(origin);
  if (incoming && allowedOriginsForRequest(request).includes(incoming)) return;
  throw new AuthError("Cross-site request blocked", 403);
}
