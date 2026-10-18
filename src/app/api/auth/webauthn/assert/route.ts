import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { attachWebAuthnCookies, verifyAssertion } from "@/lib/webauthn";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import type { UserRole } from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    const allowed = await consumeRateLimit(`webauthn:${ip}`, 8, 60_000);
    if (!allowed) return json({ error: "Too many unlock attempts" }, 429);

    const body = (await request.json()) as { response?: AuthenticationResponseJSON };
    if (!body.response) throw new Error("Face ID response is missing");
    const { userId, credential } = await verifyAssertion(request, body.response);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new Error("Account is not available");

    await writeAudit({
      actorId: user.id,
      action: "auth.webauthn.unlock",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
    });
    const payload = json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    attachWebAuthnCookies(payload, request, { credential, challenge: null });
    return attachSessionCookie(
      payload,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
      request,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
