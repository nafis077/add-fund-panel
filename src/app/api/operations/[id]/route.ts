import { requirePermission } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("payments.view");
    const { id } = await context.params;
    const operation = await prisma.paymentOperation.findUnique({
      where: { id },
      include: {
        panel: { select: { id: true, name: true, currency: true, connectionStatus: true } },
        batch: true,
        attempts: { orderBy: { startedAt: "desc" } },
      },
    });
    if (!operation) return json({ error: "Operation not found" }, 404);
    return json({ operation });
  } catch (error) {
    return handleRouteError(error);
  }
}
