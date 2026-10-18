import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { listActivity } from "@/server/history";

export async function GET() {
  try {
    await requirePermission("payments.view");
    ensureWorker();
    return json(await listActivity());
  } catch (error) {
    return handleRouteError(error);
  }
}
