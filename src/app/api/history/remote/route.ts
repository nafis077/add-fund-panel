import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { historyQuerySchema } from "@/lib/validation";
import { listRemoteHistory } from "@/server/history";

export async function GET(request: Request) {
  try {
    await requirePermission("payments.view");
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = historyQuerySchema.parse(raw);
    if (!query.panelId) return json({ error: "panelId is required for remote history" }, 400);
    const { panelId, ...filters } = query;
    return json(await listRemoteHistory(panelId, filters));
  } catch (error) {
    return handleRouteError(error);
  }
}
