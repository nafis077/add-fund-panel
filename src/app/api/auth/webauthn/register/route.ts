import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { attachWebAuthnCookies, verifyAndStoreRegistration } from "@/lib/webauthn";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const body = (await request.json()) as { response?: RegistrationResponseJSON };
    if (!body.response) throw new Error("Face ID response is missing");
    const credential = await verifyAndStoreRegistration(user, request, body.response);
    await writeAudit({
      actorId: user.id,
      action: "auth.webauthn.enable",
      entityType: "User",
      entityId: user.id,
      ipAddress: clientIp(request),
    });
    return attachWebAuthnCookies(json({ enabled: true }), request, { credential, challenge: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
