import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { approveBatch } from "@/server/queue";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.approve");
    const { id } = await context.params;
    const result = await approveBatch(id, session.id, clientIp(request));
    ensureWorker();
    return json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
