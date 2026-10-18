import { clearSessionCookie, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clientIp, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (session) {
    await writeAudit({
      actorId: session.id,
      action: "auth.logout",
      entityType: "User",
      entityId: session.id,
      ipAddress: clientIp(request),
    });
  }
  return clearSessionCookie(json({ ok: true }), request);
}
