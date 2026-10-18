import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { ensureWorker } from "@/lib/worker-runtime";
import { createPanel, listPanels } from "@/server/panels";

export async function GET(request: Request) {
  try {
    await requirePermission("payments.view");
    ensureWorker();
    const query = new URL(request.url).searchParams.get("q") ?? undefined;
    return json({ panels: await listPanels(query) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("panels.manage");
    const panel = await createPanel(await request.json(), session.id, clientIp(request));
    return json({ panel }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
