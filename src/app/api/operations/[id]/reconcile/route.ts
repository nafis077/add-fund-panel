import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { markFailedAfterVerification, reconcileOperation } from "@/server/queue";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.retry");
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { markFailed?: boolean; note?: string };
    if (body.markFailed) {
      await markFailedAfterVerification(id, session.id, body.note || "Marked failed after manual verification", clientIp(request));
      return json({ status: "FAILED" });
    }
    return json(await reconcileOperation(id, session.id, clientIp(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
