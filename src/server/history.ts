import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { listPanelPayments } from "@/lib/smm-admin-api";
import type { HistoryFilters } from "@/types/domain";

export async function listLocalOperations(filters: {
  panelId?: string;
  username?: string;
  paymentId?: string;
  status?: string;
  method?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const where = {
    ...(filters.panelId ? { panelId: filters.panelId } : {}),
    ...(filters.username ? { username: { contains: filters.username } } : {}),
    ...(filters.paymentId
      ? { OR: [{ remotePaymentId: filters.paymentId }, { internalTxnId: filters.paymentId }] }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { method: { contains: filters.method } } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { gte: filters.from, lte: filters.to } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.paymentOperation.findMany({
      where,
      include: { panel: true, batch: true, attempts: { orderBy: { startedAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentOperation.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      panel: {
        id: item.panel.id,
        name: item.panel.name,
        currency: item.panel.currency,
        connectionStatus: item.panel.connectionStatus,
      },
    })),
    total,
    page,
    pageSize,
  };
}

export async function listRemoteHistory(panelId: string, filters: HistoryFilters) {
  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel) throw new Error("Panel not found");
  const remote = await listPanelPayments(
    { baseUrl: panel.baseUrl, apiKey: decryptSecret(panel.encryptedApiKey) },
    filters,
  );

  const ids = remote.items.map((item) => item.id);
  const linked = ids.length
    ? await prisma.paymentOperation.findMany({
        where: { remotePaymentId: { in: ids } },
        select: { id: true, remotePaymentId: true, internalTxnId: true, batchId: true, status: true },
      })
    : [];
  const linkMap = new Map(linked.map((item) => [item.remotePaymentId, item]));

  return {
    panel: { id: panel.id, name: panel.name, currency: panel.currency },
    total: remote.total,
    items: remote.items.map((item) => ({
      ...item,
      localOperation: item.id ? (linkMap.get(item.id) ?? null) : null,
    })),
  };
}

export async function listBatches() {
  const batches = await prisma.paymentBatch.findMany({
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      operations: { select: { status: true, amount: true, currency: true, panelId: true } },
      panels: { include: { panel: { select: { id: true, name: true, currency: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return batches;
}

export async function listActivity(limit = 80) {
  const take = Math.min(Math.max(limit, 1), 200);
  const [audit, failures] = await Promise.all([
    prisma.paymentAuditLog.findMany({
      include: {
        actor: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.paymentOperation.findMany({
      where: {
        OR: [
          { status: "FAILED" },
          { status: "NEEDS_VERIFICATION" },
          { errorMessage: { not: null } },
        ],
      },
      include: {
        panel: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
  ]);
  return { audit, failures };
}

export async function getBatch(id: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      panels: { include: { panel: { select: { id: true, name: true, currency: true } } } },
      operations: {
        include: {
          panel: { select: { id: true, name: true, currency: true } },
          attempts: { orderBy: { startedAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!batch) throw new Error("Batch not found");
  return batch;
}
