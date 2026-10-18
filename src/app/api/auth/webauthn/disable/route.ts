import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { attachWebAuthnCookies } from "@/lib/webauthn";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    await writeAudit({
      actorId: user.id,
      action: "auth.webauthn.disable",
      entityType: "User",
      entityId: user.id,
      ipAddress: clientIp(request),
    });
    return attachWebAuthnCookies(json({ enabled: false }), request, { credential: null, challenge: null });
  } catch (error) {
    return handleRouteError(error);
  }
}
