import { attachWebAuthnCookies, registrationOptionsForUser } from "@/lib/webauthn";
import { requireSession } from "@/lib/auth";
import { assertSameOrigin, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    const options = await registrationOptionsForUser(user, request);
    return attachWebAuthnCookies(json({ options }), request, { challenge: options.challenge });
  } catch (error) {
    return handleRouteError(error);
  }
}
