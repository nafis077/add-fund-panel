import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { getDashboard } from "@/server/dashboard";

export async function GET(request: Request) {
  try {
    await requirePermission("payments.view");
    ensureWorker();
    const params = new URL(request.url).searchParams;
    return json(
      await getDashboard({
        panelId: params.get("panelId") ?? undefined,
        from: params.get("from") ? new Date(params.get("from")!) : undefined,
        to: params.get("to") ? new Date(params.get("to")!) : undefined,
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
