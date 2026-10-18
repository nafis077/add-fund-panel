import { requirePermission } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { submitBatch } from "@/server/payments";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("payments.create");
    const allowed = await consumeRateLimit(`submit:${session.id}`, 20, 60_000);
    if (!allowed) return json({ error: "Submission rate limit exceeded" }, 429);
    const result = await submitBatch(await request.json(), session.id, clientIp(request));
    return json(result, result.reused ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
