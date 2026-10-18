import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { testAndStoreConnection } from "@/server/panels";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("panels.manage");
    const { id } = await context.params;
    const result = await testAndStoreConnection(id, session.id, clientIp(request));
    return json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
