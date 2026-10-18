import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { addTotals, emptyTotals, normalizeAmount, totalsExceed } from "@/lib/money";
import { batchSubmitSchema, methodAllowedOnPanel, rowFingerprint, validateRows } from "@/lib/validation";
import { getSettings } from "@/server/settings";
import type { CurrencyTotals, PaymentRowInput, PreviewIssue } from "@/types/domain";

export type PreviewResult = {
  rows: Array<PaymentRowInput & { currency: string; panelName: string }>;
  issues: PreviewIssue[];
  panelCount: number;
  recipientCount: number;
  transactionCount: number;
  totals: CurrencyTotals;
  requiresApproval: boolean;
  requiresSecondConfirm: boolean;
  methods: string[];
};

export async function previewPayments(rows: PaymentRowInput[]): Promise<PreviewResult> {
  const settings = await getSettings();
  const issues = validateRows(rows);
  const panels = await prisma.panel.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.panelId))] } },
  });
  const panelMap = new Map(panels.map((panel) => [panel.id, panel]));

  let totals = emptyTotals();
  const hydrated = rows.map((row) => {
    const panel = panelMap.get(row.panelId);
    if (!panel) {
      issues.push({
        rowId: row.clientRowId,
        level: "error",
        code: "unknown_panel",
        message: "Selected panel does not exist",
      });
    } else if (!panel.isActive) {
      issues.push({
        rowId: row.clientRowId,
        level: "error",
        code: "inactive_panel",
        message: `${panel.name} is disabled`,
      });
    } else if (row.method && !methodAllowedOnPanel(row.method, panel.paymentMethods)) {
      issues.push({
        rowId: row.clientRowId,
        level: "error",
        code: "unknown_method",
        message: `"${row.method}" is not enabled on ${panel.name}`,
      });
    }
    const currency = row.currency || panel?.currency || "USD";
    const amount = (() => {
      try {
        return normalizeAmount(row.amount);
      } catch {
        return row.amount;
      }
    })();
    if (panel && parseFloat(amount) > 0) {
      totals = addTotals(totals, currency, amount);
    }
    return {
      ...row,
      amount,
      currency,
      panelName: panel?.name ?? "Unknown panel",
      method: row.method || settings.defaultPaymentMethod,
    };
  });

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const requiresApproval =
    settings.highValueApprovalEnabled &&
    (totalsExceed(totals, settings.highValueApprovalThreshold, settings.highValueApprovalCurrency) ||
      hydrated.some(
        (row) =>
          row.currency === settings.highValueApprovalCurrency &&
          new Decimal(row.amount || 0).gte(settings.highValueApprovalThreshold),
      ));

  return {
    rows: hydrated,
    issues,
    panelCount: new Set(hydrated.map((row) => row.panelId)).size,
    recipientCount: new Set(hydrated.map((row) => `${row.panelId}:${row.username.toLowerCase()}`)).size,
    transactionCount: hydrated.length,
    totals,
    requiresApproval: requiresApproval && errorCount === 0,
    requiresSecondConfirm: totalsExceed(totals, settings.requireSecondConfirmAbove, settings.highValueApprovalCurrency),
    methods: [...new Set(hydrated.map((row) => row.method))],
  };
}

export async function submitBatch(input: unknown, actorId: string, ip?: string) {
  const parsed = batchSubmitSchema.parse(input);
  const preview = await previewPayments(parsed.rows);
  if (preview.issues.some((issue) => issue.level === "error")) {
    throw new Error("Resolve invalid rows before submitting payments");
  }
  if (!parsed.confirmation) {
    throw new Error("Explicit confirmation is required");
  }

  const existing = await prisma.paymentBatch.findUnique({
    where: { clientSubmissionId: parsed.clientSubmissionId },
    include: { operations: true },
  });
  if (existing) {
    return { batch: existing, reused: true, preview };
  }

  const status = preview.requiresApproval ? "PENDING_APPROVAL" : "QUEUED";
  const panelIds = [...new Set(preview.rows.map((row) => row.panelId))];

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentBatch.create({
      data: {
        name: parsed.name,
        workflow: parsed.workflow,
        status,
        clientSubmissionId: parsed.clientSubmissionId,
        createdById: actorId,
        panelSnapshot: JSON.stringify(panelIds),
        panels: { create: panelIds.map((panelId) => ({ panelId })) },
        operations: {
          create: preview.rows.map((row) => ({
            internalTxnId: `txn_${crypto.randomUUID().replaceAll("-", "")}`,
            panelId: row.panelId,
            username: row.username.trim(),
            amount: row.amount,
            currency: row.currency,
            method: row.method,
            memo: row.memo?.trim() || null,
            affiliateCommission: Boolean(row.affiliateCommission),
            status: status === "PENDING_APPROVAL" ? "QUEUED" : "QUEUED",
            rowFingerprint: rowFingerprint(row),
            clientRowId: row.clientRowId,
          })),
        },
      },
      include: { operations: { include: { panel: true } }, createdBy: true },
    });
    return created;
  });

  await writeAudit({
    actorId,
    action: preview.requiresApproval ? "batch.pending_approval" : "batch.submit",
    entityType: "PaymentBatch",
    entityId: batch.id,
    batchId: batch.id,
    metadata: {
      name: batch.name,
      transactions: preview.transactionCount,
      totals: preview.totals,
    },
    ipAddress: ip,
  });

  return { batch, reused: false, preview };
}

export function summarizeBatch(operations: Array<{ status: string; amount: string; currency: string }>) {
  const counts = {
    total: operations.length,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    needsVerification: 0,
    cancelled: 0,
  };
  let requested = emptyTotals();
  let confirmed = emptyTotals();
  for (const operation of operations) {
    requested = addTotals(requested, operation.currency, operation.amount);
    switch (operation.status) {
      case "QUEUED":
        counts.queued += 1;
        break;
      case "PROCESSING":
        counts.processing += 1;
        break;
      case "COMPLETED":
        counts.completed += 1;
        confirmed = addTotals(confirmed, operation.currency, operation.amount);
        break;
      case "FAILED":
        counts.failed += 1;
        break;
      case "NEEDS_VERIFICATION":
        counts.needsVerification += 1;
        break;
      case "CANCELLED":
        counts.cancelled += 1;
        break;
      default: {
        const _never: never = operation.status as never;
        void _never;
      }
    }
  }
  const terminal = counts.completed + counts.failed + counts.needsVerification + counts.cancelled;
  const progress = counts.total === 0 ? 0 : Math.round((terminal / counts.total) * 100);
  return { counts, requested, confirmed, progress };
}

export function deriveBatchStatus(
  current: string,
  counts: ReturnType<typeof summarizeBatch>["counts"],
): string {
  if (current === "PENDING_APPROVAL") return current;
  if (current === "CANCELLED" && counts.queued === 0 && counts.processing === 0) return "CANCELLED";
  if (counts.processing > 0 || (counts.queued > 0 && counts.completed + counts.failed + counts.needsVerification > 0)) {
    return "PROCESSING";
  }
  if (counts.queued > 0) return "QUEUED";
  if (counts.completed === counts.total) return "COMPLETED";
  if (counts.cancelled === counts.total) return "CANCELLED";
  return "PARTIAL";
}
