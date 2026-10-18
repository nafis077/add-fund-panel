import { prisma } from "@/lib/prisma";
import { decryptSecret, sha256 } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { safeJson } from "@/lib/redact";
import { addPanelPayment, buildInternalMemo, listPanelPayments } from "@/lib/smm-admin-api";
import { deriveBatchStatus, summarizeBatch } from "@/server/payments";
import type { OperationStatus } from "@/types/domain";

const CLAIM_TTL_MS = 60_000;

const panelLastRequest = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryEligible(operation: {
  status: string;
  lastAttemptOutcome: string | null;
}): boolean {
  if (operation.status === "COMPLETED" || operation.status === "CANCELLED" || operation.status === "PROCESSING") {
    return false;
  }
  if (operation.status === "NEEDS_VERIFICATION") return false;
  if (operation.status === "FAILED") {
    return operation.lastAttemptOutcome === "FAILED" || operation.lastAttemptOutcome === "RATE_LIMITED";
  }
  return operation.status === "QUEUED";
}

export async function recoverStaleClaims(now = new Date()): Promise<number> {
  const stale = await prisma.paymentOperation.findMany({
    where: {
      status: "PROCESSING",
      OR: [{ claimExpiresAt: { lt: now } }, { claimExpiresAt: null, claimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } }],
    },
    include: { attempts: { orderBy: { startedAt: "desc" }, take: 1 } },
  });

  for (const operation of stale) {
    const last = operation.attempts[0];
    if (last?.submitted && (last.outcome === "TIMEOUT" || last.outcome === "UNKNOWN" || last.outcome === "NETWORK")) {
      await prisma.paymentOperation.update({
        where: { id: operation.id },
        data: {
          status: "NEEDS_VERIFICATION",
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
          errorMessage: "Recovered after worker restart with an uncertain API outcome",
        },
      });
    } else if (!last || !last.submitted) {
      await prisma.paymentOperation.update({
        where: { id: operation.id },
        data: {
          status: "QUEUED",
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
        },
      });
    } else {
      await prisma.paymentOperation.update({
        where: { id: operation.id },
        data: {
          status: last.outcome === "SUCCESS" ? "COMPLETED" : "FAILED",
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
        },
      });
    }
  }
  return stale.length;
}

export async function claimNextOperation(workerId: string) {
  return prisma.$transaction(async (tx) => {
    const queued = await tx.paymentOperation.findMany({
      where: {
        status: "QUEUED",
        batch: { status: { in: ["QUEUED", "PROCESSING"] } },
        panel: { isActive: true },
      },
      include: { panel: true, batch: true },
      orderBy: { createdAt: "asc" },
      take: 25,
    });

    for (const operation of queued) {
      const inflight = await tx.paymentOperation.count({
        where: { panelId: operation.panelId, status: "PROCESSING" },
      });
      if (inflight >= operation.panel.concurrencyLimit) continue;

      const claimed = await tx.paymentOperation.updateMany({
        where: { id: operation.id, status: "QUEUED" },
        data: {
          status: "PROCESSING",
          claimedAt: new Date(),
          claimedBy: workerId,
          claimExpiresAt: new Date(Date.now() + CLAIM_TTL_MS),
        },
      });
      if (claimed.count === 1) {
        await tx.paymentBatch.update({
          where: { id: operation.batchId },
          data: { status: "PROCESSING" },
        });
        return tx.paymentOperation.findUnique({
          where: { id: operation.id },
          include: { panel: true, batch: true },
        });
      }
    }
    return null;
  });
}

async function respectPanelRateLimit(panelId: string, minIntervalMs: number) {
  const last = panelLastRequest.get(panelId) ?? 0;
  const wait = minIntervalMs - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  panelLastRequest.set(panelId, Date.now());
}

export async function executeOperation(operationId: string, actorId?: string | null) {
  const operation = await prisma.paymentOperation.findUnique({
    where: { id: operationId },
    include: { panel: true },
  });
  if (!operation) throw new Error("Operation not found");
  if (operation.status !== "PROCESSING") {
    throw new Error("Operation is not claimed for processing");
  }

  const attempt = await prisma.paymentAttempt.create({
    data: {
      operationId: operation.id,
      actorId: actorId ?? null,
      outcome: "UNKNOWN",
      submitted: false,
      requestFingerprint: sha256(
        `${operation.panelId}|${operation.username}|${operation.amount}|${operation.method}|${operation.internalTxnId}`,
      ),
    },
  });

  await respectPanelRateLimit(operation.panelId, operation.panel.minRequestIntervalMs);
  const started = Date.now();

  const result = await addPanelPayment(
    {
      baseUrl: operation.panel.baseUrl,
      apiKey: decryptSecret(operation.panel.encryptedApiKey),
    },
    {
      username: operation.username,
      amount: Number(operation.amount),
      method: operation.method,
      memo: buildInternalMemo(operation.internalTxnId, operation.memo),
      affiliate_commission: operation.affiliateCommission,
    },
    { timeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS ?? 15_000) },
  );

  const durationMs = Date.now() - started;
  let nextStatus: OperationStatus;
  if (result.ok) {
    nextStatus = "COMPLETED";
  } else if (result.outcome === "TIMEOUT" || (result.submitted && result.outcome === "NETWORK")) {
    nextStatus = "NEEDS_VERIFICATION";
  } else {
    nextStatus = "FAILED";
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        finishedAt: new Date(),
        outcome: result.outcome,
        submitted: result.submitted,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode == null ? null : String(result.errorCode),
        remotePaymentId: result.paymentId,
        redactedResponse: safeJson(result.rawRedacted),
        durationMs,
      },
    });
    await tx.paymentOperation.update({
      where: { id: operation.id },
      data: {
        status: nextStatus,
        remotePaymentId: result.paymentId,
        remoteBalance: result.balance,
        remoteCurrency: result.currency,
        errorMessage: result.errorMessage,
        executionMs: durationMs,
        processedAt: nextStatus === "COMPLETED" ? new Date() : operation.processedAt,
        lastAttemptAt: new Date(),
        lastAttemptOutcome: result.outcome,
        claimedAt: null,
        claimedBy: null,
        claimExpiresAt: null,
        retryCount: result.ok ? operation.retryCount : operation.retryCount,
      },
    });
  });

  await refreshBatchProgress(operation.batchId);
  await writeAudit({
    actorId: actorId ?? null,
    action: result.ok ? "payment.completed" : `payment.${result.outcome.toLowerCase()}`,
    entityType: "PaymentOperation",
    entityId: operation.id,
    batchId: operation.batchId,
    metadata: {
      username: operation.username,
      panel: operation.panel.name,
      amount: operation.amount,
      currency: operation.currency,
      status: nextStatus,
      error: result.errorMessage,
      remotePaymentId: result.paymentId,
    },
  });
  return { result, nextStatus };
}

export async function refreshBatchProgress(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: { operations: true },
  });
  if (!batch) return;
  const summary = summarizeBatch(batch.operations);
  const status = deriveBatchStatus(batch.status, summary.counts);
  if (status !== batch.status) {
    await prisma.paymentBatch.update({ where: { id: batchId }, data: { status } });
  }
  return { ...summary, status };
}

export async function retryFailedOperations(batchId: string, actorId: string, ip?: string) {
  const operations = await prisma.paymentOperation.findMany({ where: { batchId } });
  const eligible = operations.filter(isRetryEligible);
  if (eligible.length === 0) return { retried: 0 };

  await prisma.paymentOperation.updateMany({
    where: { id: { in: eligible.map((item) => item.id) } },
    data: {
      status: "QUEUED",
      errorMessage: null,
      claimedAt: null,
      claimedBy: null,
      claimExpiresAt: null,
      retryCount: { increment: 1 },
    },
  });
  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: "QUEUED", cancelledAt: null },
  });
  await writeAudit({
    actorId,
    action: "batch.retry",
    entityType: "PaymentBatch",
    entityId: batchId,
    batchId,
    metadata: { operationIds: eligible.map((item) => item.id) },
    ipAddress: ip,
  });
  return { retried: eligible.length };
}

export async function cancelQueuedOperations(batchId: string, actorId: string, reason?: string, ip?: string) {
  const result = await prisma.paymentOperation.updateMany({
    where: { batchId, status: "QUEUED" },
    data: { status: "CANCELLED", processedAt: new Date() },
  });
  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { cancelledAt: new Date(), cancelReason: reason ?? "Cancelled remaining queued payments" },
  });
  await refreshBatchProgress(batchId);
  await writeAudit({
    actorId,
    action: "batch.cancel_queued",
    entityType: "PaymentBatch",
    entityId: batchId,
    batchId,
    metadata: { cancelled: result.count, reason },
    ipAddress: ip,
  });
  return { cancelled: result.count };
}

export async function approveBatch(batchId: string, actorId: string, ip?: string) {
  const batch = await prisma.paymentBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");
  if (batch.status !== "PENDING_APPROVAL") throw new Error("Batch is not awaiting approval");
  if (batch.createdById === actorId) {
    throw new Error("A different administrator must approve this high-value batch");
  }
  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: "QUEUED", approvedById: actorId, approvedAt: new Date() },
  });
  await writeAudit({
    actorId,
    action: "batch.approve",
    entityType: "PaymentBatch",
    entityId: batchId,
    batchId,
    ipAddress: ip,
  });
  return { approved: true };
}

export async function reconcileOperation(operationId: string, actorId: string, ip?: string) {
  const operation = await prisma.paymentOperation.findUnique({
    where: { id: operationId },
    include: { panel: true },
  });
  if (!operation) throw new Error("Operation not found");
  if (operation.status !== "NEEDS_VERIFICATION") {
    throw new Error("Only uncertain payments can be reconciled");
  }

  const history = await listPanelPayments(
    {
      baseUrl: operation.panel.baseUrl,
      apiKey: decryptSecret(operation.panel.encryptedApiKey),
    },
    {
      username: operation.username,
      memo: operation.internalTxnId,
      limit: 50,
    },
  );

  const match = history.items.find(
    (item) =>
      item.memo?.includes(operation.internalTxnId) ||
      (operation.remotePaymentId && item.id === operation.remotePaymentId),
  );

  if (match && ["completed", "waiting", "pending", "hold"].includes((match.status ?? "").toLowerCase())) {
    await prisma.paymentOperation.update({
      where: { id: operationId },
      data: {
        status: "COMPLETED",
        remotePaymentId: match.id,
        remoteBalance: match.balance,
        remoteCurrency: match.currency,
        verificationNotes: `Matched remote payment ${match.id}`,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
    await writeAudit({
      actorId,
      action: "operation.reconcile_completed",
      entityType: "PaymentOperation",
      entityId: operationId,
      batchId: operation.batchId,
      metadata: { remotePaymentId: match.id },
      ipAddress: ip,
    });
    await refreshBatchProgress(operation.batchId);
    return { status: "COMPLETED", remotePaymentId: match.id };
  }

  if (match && ["fail", "expired"].includes((match.status ?? "").toLowerCase())) {
    await prisma.paymentOperation.update({
      where: { id: operationId },
      data: {
        status: "FAILED",
        lastAttemptOutcome: "FAILED",
        remotePaymentId: match.id,
        verificationNotes: `Remote payment ${match.id} is ${match.status}`,
        errorMessage: `Remote payment status: ${match.status}`,
      },
    });
    await writeAudit({
      actorId,
      action: "operation.reconcile_failed",
      entityType: "PaymentOperation",
      entityId: operationId,
      batchId: operation.batchId,
      metadata: { remotePaymentId: match.id, status: match.status },
      ipAddress: ip,
    });
    await refreshBatchProgress(operation.batchId);
    return { status: "FAILED", remotePaymentId: match.id };
  }

  return {
    status: "NEEDS_VERIFICATION",
    remotePaymentId: match?.id ?? null,
    message: "No conclusive remote payment was found. Do not retry until verified.",
  };
}

export async function markFailedAfterVerification(operationId: string, actorId: string, note: string, ip?: string) {
  const operation = await prisma.paymentOperation.findUnique({ where: { id: operationId } });
  if (!operation || operation.status !== "NEEDS_VERIFICATION") {
    throw new Error("Only uncertain payments can be marked failed after verification");
  }
  await prisma.paymentOperation.update({
    where: { id: operationId },
    data: {
      status: "FAILED",
      lastAttemptOutcome: "FAILED",
      verificationNotes: note,
      errorMessage: note,
    },
  });
  await writeAudit({
    actorId,
    action: "operation.mark_failed_verified",
    entityType: "PaymentOperation",
    entityId: operationId,
    batchId: operation.batchId,
    metadata: { note },
    ipAddress: ip,
  });
  await refreshBatchProgress(operation.batchId);
}

export async function processAvailableJobs(workerId: string, limit = 10): Promise<number> {
  await recoverStaleClaims();
  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const claimed = await claimNextOperation(workerId);
    if (!claimed) break;
    await executeOperation(claimed.id);
    processed += 1;
  }
  return processed;
}

