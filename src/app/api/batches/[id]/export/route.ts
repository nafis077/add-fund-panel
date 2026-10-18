import { requirePermission } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { getBatch } from "@/server/history";
import { toCsv } from "@/lib/validation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("payments.view");
    const { id } = await context.params;
    const batch = await getBatch(id);
    const csv = toCsv(
      batch.operations.map((operation) => ({
        batch: batch.name,
        internal_txn_id: operation.internalTxnId,
        panel: operation.panel.name,
        username: operation.username,
        amount: operation.amount,
        currency: operation.currency,
        method: operation.method,
        status: operation.status,
        remote_payment_id: operation.remotePaymentId ?? "",
        balance: operation.remoteBalance ?? "",
        error: operation.errorMessage ?? "",
        execution_ms: operation.executionMs ?? "",
      })),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${batch.name.replaceAll(/[^\w.-]+/g, "_")}.csv"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
