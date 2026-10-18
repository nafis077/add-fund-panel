import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { processAvailableJobs, retryFailedOperations } from "@/server/queue";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.retry");
    const { id } = await context.params;
    const result = await retryFailedOperations(id, session.id, clientIp(request));
    ensureWorker();
    await processAvailableJobs(`retry_${process.pid}`, 10);
    return json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
