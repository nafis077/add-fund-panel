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

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    throw new AuthError("Cross-site request blocked", 403);
  }
}
