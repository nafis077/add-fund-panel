import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { deletePanel, updatePanel } from "@/server/panels";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("panels.manage");
    const { id } = await context.params;
    const panel = await updatePanel(id, await request.json(), session.id, clientIp(request));
    return json({ panel });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("panels.manage");
    const { id } = await context.params;
    await deletePanel(id, session.id, clientIp(request));
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
