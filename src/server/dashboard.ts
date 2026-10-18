import { prisma } from "@/lib/prisma";
import { addTotals, emptyTotals } from "@/lib/money";
import { summarizeBatch } from "@/server/payments";

export async function getDashboard(filters: { from?: Date; to?: Date; panelId?: string }) {
  const createdAt = {
    gte: filters.from,
    lte: filters.to,
  };
  const opWhere = {
    ...(filters.panelId ? { panelId: filters.panelId } : {}),
    ...(filters.from || filters.to ? { createdAt } : {}),
  };

  const [panels, operations, batches, recentFailed, recentCompleted] = await Promise.all([
    prisma.panel.findMany(),
    prisma.paymentOperation.findMany({
      where: opWhere,
      include: { panel: { select: { id: true, name: true, currency: true } }, batch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.paymentBatch.findMany({
      include: { operations: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.paymentOperation.findMany({
      where: { ...opWhere, status: "FAILED" },
      include: { panel: { select: { id: true, name: true, currency: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.paymentOperation.findMany({
      where: { ...opWhere, status: "COMPLETED" },
      include: { panel: { select: { id: true, name: true, currency: true } } },
      orderBy: { processedAt: "desc" },
      take: 8,
    }),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completed = operations.filter((item) => item.status === "COMPLETED");
  const failed = operations.filter((item) => item.status === "FAILED");
  const needsVerification = operations.filter((item) => item.status === "NEEDS_VERIFICATION");
  const today = operations.filter((item) => item.createdAt >= todayStart);

  let funds = emptyTotals();
  for (const item of completed) funds = addTotals(funds, item.currency, item.amount);

  const dailyMap = new Map<string, { date: string; completed: number; failed: number; totals: Record<string, string> }>();
  for (const item of operations) {
    const date = item.createdAt.toISOString().slice(0, 10);
    const current = dailyMap.get(date) ?? { date, completed: 0, failed: 0, totals: {} };
    if (item.status === "COMPLETED") {
      current.completed += 1;
      current.totals = addTotals(current.totals, item.currency, item.amount);
    }
    if (item.status === "FAILED") current.failed += 1;
    dailyMap.set(date, current);
  }

  const volumeByPanel = panels.map((panel) => {
    const panelOps = completed.filter((item) => item.panelId === panel.id);
    let totals = emptyTotals();
    for (const item of panelOps) totals = addTotals(totals, item.currency, item.amount);
    return {
      panelId: panel.id,
      name: panel.name,
      completed: panelOps.length,
      totals,
    };
  });

  return {
    cards: {
      totalPanels: panels.length,
      activePanels: panels.filter((panel) => panel.isActive).length,
      fundsAdded: funds,
      transactionsToday: today.length,
      completed: completed.length,
      failed: failed.length,
      needsVerification: needsVerification.length,
    },
    charts: {
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      volumeByPanel,
      successVsFailed: [
        { name: "Completed", value: completed.length },
        { name: "Failed", value: failed.length },
        { name: "Needs verification", value: needsVerification.length },
      ],
    },
    recentCompleted,
    recentFailed,
    activeBatches: batches
      .map((batch) => ({ ...batch, summary: summarizeBatch(batch.operations) }))
      .filter((batch) => ["QUEUED", "PROCESSING", "PENDING_APPROVAL"].includes(batch.status)),
  };
}
