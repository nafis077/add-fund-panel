import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/redact";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  batchId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  await prisma.paymentAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      batchId: input.batchId ?? null,
      metadata: safeJson(input.metadata ?? {}),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
