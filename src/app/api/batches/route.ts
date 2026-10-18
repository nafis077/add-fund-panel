import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { listBatches } from "@/server/history";
import { summarizeBatch } from "@/server/payments";

export async function GET() {
  try {
    await requirePermission("payments.view");
    const batches = await listBatches();
    return json({
      batches: batches.map((batch) => ({
        ...batch,
        summary: summarizeBatch(batch.operations),
        operations: undefined,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
