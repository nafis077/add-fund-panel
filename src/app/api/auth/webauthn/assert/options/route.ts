import { assertionOptions, attachWebAuthnCookies } from "@/lib/webauthn";
import { assertSameOrigin, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const options = await assertionOptions(request);
    return attachWebAuthnCookies(json({ options }), request, { challenge: options.challenge });
  } catch (error) {
    return handleRouteError(error);
  }
}
