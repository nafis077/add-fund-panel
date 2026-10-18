import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, secretLast4 } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { panelInputSchema, normalizeBaseUrl } from "@/lib/validation";
import { testPanelConnection } from "@/lib/smm-admin-api";
import { addTotals, emptyTotals } from "@/lib/money";
import { maskKey } from "@/lib/redact";
import type { Prisma } from "@prisma/client";

function publicPanel<T extends { encryptedApiKey: string; apiKeyLast4: string }>(panel: T) {
  const { encryptedApiKey, ...rest } = panel;
  void encryptedApiKey;
  return {
    ...rest,
    apiKeyMasked: maskKey(panel.apiKeyLast4),
  };
}

export async function listPanels(query?: string) {
  const where: Prisma.PanelWhereInput = query
    ? {
        OR: [
          { name: { contains: query } },
          { baseUrl: { contains: query } },
          { currency: { contains: query } },
        ],
      }
    : {};

  const panels = await prisma.panel.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const stats = await prisma.paymentOperation.groupBy({
    by: ["panelId", "status", "currency"],
    _count: { _all: true },
  });

  const amounts = await prisma.paymentOperation.findMany({
    where: { status: "COMPLETED" },
    select: { panelId: true, amount: true, currency: true },
  });

  return panels.map((panel) => {
    const panelStats = stats.filter((row) => row.panelId === panel.id);
    const totals = amounts
      .filter((row) => row.panelId === panel.id)
      .reduce((acc, row) => addTotals(acc, row.currency, row.amount), emptyTotals());
    return {
      ...publicPanel(panel),
      totalTransactions: panelStats.reduce((sum, row) => sum + row._count._all, 0),
      completedTransactions: panelStats
        .filter((row) => row.status === "COMPLETED")
        .reduce((sum, row) => sum + row._count._all, 0),
      fundsAdded: totals,
    };
  });
}

export async function createPanel(input: unknown, actorId: string, ip?: string) {
  const data = panelInputSchema.parse(input);
  if (!data.apiKey) throw new Error("API key is required");
  const apiKey = data.apiKey;
  const baseUrl = normalizeBaseUrl(data.baseUrl);

  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.panel.updateMany({ data: { isDefault: false } });
    }
    return tx.panel.create({
      data: {
        name: data.name,
        baseUrl,
        encryptedApiKey: encryptSecret(apiKey),
        apiKeyLast4: secretLast4(apiKey),
        currency: data.currency.toUpperCase(),
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        concurrencyLimit: data.concurrencyLimit ?? 2,
        minRequestIntervalMs: data.minRequestIntervalMs ?? 250,
      },
    });
  });

  await writeAudit({
    actorId,
    action: "panel.create",
    entityType: "Panel",
    entityId: created.id,
    metadata: { name: created.name, baseUrl: created.baseUrl },
    ipAddress: ip,
  });
  return publicPanel(created);
}

export async function updatePanel(id: string, input: unknown, actorId: string, ip?: string) {
  const data = panelInputSchema.partial().parse(input);
  const existing = await prisma.panel.findUnique({ where: { id } });
  if (!existing) throw new Error("Panel not found");

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.panel.updateMany({ data: { isDefault: false } });
    }
    return tx.panel.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        baseUrl: data.baseUrl ? normalizeBaseUrl(data.baseUrl) : existing.baseUrl,
        currency: data.currency ? data.currency.toUpperCase() : existing.currency,
        isActive: data.isActive ?? existing.isActive,
        isDefault: data.isDefault ?? existing.isDefault,
        concurrencyLimit: data.concurrencyLimit ?? existing.concurrencyLimit,
        minRequestIntervalMs: data.minRequestIntervalMs ?? existing.minRequestIntervalMs,
        ...(data.apiKey
          ? {
              encryptedApiKey: encryptSecret(data.apiKey),
              apiKeyLast4: secretLast4(data.apiKey),
              connectionStatus: "UNKNOWN",
            }
          : {}),
      },
    });
  });

  await writeAudit({
    actorId,
    action: "panel.update",
    entityType: "Panel",
    entityId: id,
    metadata: { name: updated.name, apiKeyRotated: Boolean(data.apiKey) },
    ipAddress: ip,
  });
  return publicPanel(updated);
}

export async function deletePanel(id: string, actorId: string, ip?: string) {
  const existing = await prisma.panel.findUnique({ where: { id } });
  if (!existing) throw new Error("Panel not found");
  await prisma.panel.delete({ where: { id } });
  await writeAudit({
    actorId,
    action: "panel.delete",
    entityType: "Panel",
    entityId: id,
    metadata: { name: existing.name },
    ipAddress: ip,
  });
}

export async function getPanelCredentials(id: string) {
  const panel = await prisma.panel.findUnique({ where: { id } });
  if (!panel) throw new Error("Panel not found");
  return {
    panel,
    credentials: {
      baseUrl: panel.baseUrl,
      apiKey: decryptSecret(panel.encryptedApiKey),
    },
  };
}

export async function testAndStoreConnection(id: string, actorId: string, ip?: string) {
  const { panel, credentials } = await getPanelCredentials(id);
  const result = await testPanelConnection(credentials);
  const updated = await prisma.panel.update({
    where: { id },
    data: {
      connectionStatus: result.ok ? "CONNECTED" : "FAILED",
      lastCheckedAt: new Date(),
      lastError: result.ok ? null : result.message,
    },
  });
  await writeAudit({
    actorId,
    action: "panel.test",
    entityType: "Panel",
    entityId: id,
    metadata: { ok: result.ok, name: panel.name },
    ipAddress: ip,
  });
  return { ...publicPanel(updated), test: result };
}
