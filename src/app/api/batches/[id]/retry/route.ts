import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { retryFailedOperations } from "@/server/queue";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.retry");
    const { id } = await context.params;
    return json(await retryFailedOperations(id, session.id, clientIp(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
