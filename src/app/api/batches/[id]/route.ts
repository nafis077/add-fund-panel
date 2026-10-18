import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { getBatch } from "@/server/history";
import { summarizeBatch } from "@/server/payments";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("payments.view");
    ensureWorker();
    const { id } = await context.params;
    const batch = await getBatch(id);
    return json({ batch: { ...batch, summary: summarizeBatch(batch.operations) } });
  } catch (error) {
    return handleRouteError(error);
  }
}
