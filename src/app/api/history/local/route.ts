import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { listLocalOperations } from "@/server/history";

export async function GET(request: Request) {
  try {
    await requirePermission("payments.view");
    const params = new URL(request.url).searchParams;
    return json(
      await listLocalOperations({
        panelId: params.get("panelId") ?? undefined,
        username: params.get("username") ?? undefined,
        paymentId: params.get("paymentId") ?? undefined,
        status: params.get("status") ?? undefined,
        method: params.get("method") ?? undefined,
        from: params.get("from") ? new Date(params.get("from")!) : undefined,
        to: params.get("to") ? new Date(params.get("to")!) : undefined,
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 25),
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
