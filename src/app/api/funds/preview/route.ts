import { requirePermission } from "@/lib/auth";
import { assertSameOrigin, handleRouteError, json } from "@/lib/http";
import { previewPayments } from "@/server/payments";
import type { PaymentRowInput } from "@/types/domain";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requirePermission("payments.create");
    const body = (await request.json()) as { rows?: PaymentRowInput[] };
    return json(await previewPayments(body.rows ?? []));
  } catch (error) {
    return handleRouteError(error);
  }
}
