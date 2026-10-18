import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { cancelQueuedOperations } from "@/server/queue";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.cancel");
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    return json(await cancelQueuedOperations(id, session.id, body.reason, clientIp(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
