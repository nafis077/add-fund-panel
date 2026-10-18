import { json } from "@/lib/http";
import { readStoredCredential } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return json({ enabled: Boolean(readStoredCredential(request)) });
}
