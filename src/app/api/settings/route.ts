import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { getSettings, updateSettings } from "@/server/settings";

export async function GET() {
  try {
    await requirePermission("payments.view");
    return json({ settings: await getSettings() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings.manage");
    return json({ settings: await updateSettings(await request.json(), session.id, clientIp(request)) });
  } catch (error) {
    return handleRouteError(error);
  }
}
