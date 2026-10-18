import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { previewPayments, submitBatch, summarizeBatch } from "@/server/payments";
import {
  approveBatch,
  cancelQueuedOperations,
  claimNextOperation,
  executeOperation,
  isRetryEligible,
  processAvailableJobs,
  recoverStaleClaims,
  retryFailedOperations,
} from "@/server/queue";
import { createAdmin, createPanel, jsonResponse, resetDb, successPaymentResponse } from "./helpers";

const originalFetch = global.fetch;

describe("fund operations", () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("previews a single-user credit and same username across multiple panels", async () => {
    const a = await createPanel("Panel A");
    const b = await createPanel("Panel B", { currency: "USD" });
    const preview = await previewPayments([
      { clientRowId: "1", panelId: a.id, username: "john", amount: "50", method: "Admin Credit" },
      { clientRowId: "2", panelId: b.id, username: "john", amount: "50", method: "Admin Credit" },
    ]);
    expect(preview.panelCount).toBe(2);
    expect(preview.recipientCount).toBe(2);
    expect(preview.transactionCount).toBe(2);
    expect(preview.totals.USD).toBe("100");
  });

  it("supports different users and amounts across panels", async () => {
    const a = await createPanel("Panel A");
    const b = await createPanel("Panel B", { currency: "EUR" });
    const preview = await previewPayments([
      { clientRowId: "1", panelId: a.id, username: "john", amount: "50", method: "Admin Credit" },
      { clientRowId: "2", panelId: b.id, username: "alex", amount: "100", method: "Admin Credit" },
    ]);
    expect(preview.totals).toEqual({ USD: "50", EUR: "100" });
    expect(preview.recipientCount).toBe(2);
  });

  it("rejects invalid usernames, amounts, and inactive panels", async () => {
    const panel = await createPanel("Panel A", { isActive: false });
    const preview = await previewPayments([
      { clientRowId: "1", panelId: panel.id, username: "john", amount: "-2", method: "Admin Credit" },
      { clientRowId: "2", panelId: "missing", username: "bad name", amount: "10", method: "Admin Credit" },
    ]);
    expect(preview.issues.some((issue) => issue.code === "inactive_panel")).toBe(true);
    expect(preview.issues.some((issue) => issue.code === "unknown_panel")).toBe(true);
    expect(preview.issues.some((issue) => issue.level === "error")).toBe(true);
  });

  it("creates a durable batch and reuses duplicate submissions", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const payload = {
      name: "October User Bonus Distribution",
      workflow: "SAME_USER" as const,
      clientSubmissionId: "11111111-1111-4111-8111-111111111111",
      confirmation: true as const,
      rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit" }],
    };
    const first = await submitBatch(payload, admin.id);
    const second = await submitBatch(payload, admin.id);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.batch.id).toBe(first.batch.id);
    expect(first.batch.operations[0]?.internalTxnId.startsWith("txn_")).toBe(true);
  });

  it("requires a second admin for high-value batches", async () => {
    const creator = await createAdmin("ADMIN", "creator@localhost");
    const approver = await createAdmin("ADMIN", "approver@localhost");
    await prisma.appSetting.update({
      where: { id: "default" },
      data: { highValueApprovalEnabled: true, highValueApprovalThreshold: "20" },
    });
    const panel = await createPanel("Panel A");
    const { batch } = await submitBatch(
      {
        name: "High value",
        workflow: "SAME_USER",
        clientSubmissionId: "22222222-2222-4222-8222-222222222222",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "50", method: "Admin Credit" }],
      },
      creator.id,
    );
    expect(batch.status).toBe("PENDING_APPROVAL");
    await expect(approveBatch(batch.id, creator.id)).rejects.toThrow(/different administrator/);
    const approved = await approveBatch(batch.id, approver.id);
    expect(approved.approved).toBe(true);
    const logs = await prisma.paymentAuditLog.findMany({ where: { batchId: batch.id } });
    expect(logs.some((log) => log.action === "batch.approve")).toBe(true);
  });

  it("credits through the Admin API and records a completed operation", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const { batch } = await submitBatch(
      {
        name: "Single credit",
        workflow: "SAME_USER",
        clientSubmissionId: "33333333-3333-4333-8333-333333333333",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit", memo: "bonus" }],
      },
      admin.id,
    );

    global.fetch = vi.fn(async (input, init) => {
      expect(String(input)).toBe("https://panela.example/adminapi/v2/payments/add");
      expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("panel-admin-key-123456");
      const body = JSON.parse(String(init?.body)) as { username: string; amount: number; method: string; memo: string };
      expect(body.username).toBe("john");
      expect(body.amount).toBe(12);
      expect(body.method).toBe("Admin Credit");
      expect(body.memo).toContain(batch.operations[0]?.internalTxnId);
      return jsonResponse(successPaymentResponse("pay_100", "88.5"));
    }) as typeof fetch;

    const processed = await processAvailableJobs("worker-1", 3);
    expect(processed).toBe(1);
    const operation = await prisma.paymentOperation.findFirst({ where: { batchId: batch.id } });
    expect(operation?.status).toBe("COMPLETED");
    expect(operation?.remotePaymentId).toBe("pay_100");
    expect(operation?.remoteBalance).toBe("88.5");
  });

  it("continues a batch when one payment fails", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A", { concurrencyLimit: 1 });
    const { batch } = await submitBatch(
      {
        name: "Partial",
        workflow: "MIXED_ROWS",
        clientSubmissionId: "44444444-4444-4444-8444-444444444444",
        confirmation: true,
        rows: [
          { clientRowId: "a", panelId: panel.id, username: "john", amount: "10", method: "Admin Credit" },
          { clientRowId: "b", panelId: panel.id, username: "alex", amount: "15", method: "Admin Credit" },
        ],
      },
      admin.id,
    );

    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ error_code: 104, error_message: "User not found" });
      return jsonResponse(successPaymentResponse("pay_ok"));
    }) as typeof fetch;

    await processAvailableJobs("worker-1", 5);
    const ops = await prisma.paymentOperation.findMany({ where: { batchId: batch.id } });
    expect(ops.some((item) => item.status === "FAILED")).toBe(true);
    expect(ops.some((item) => item.status === "COMPLETED")).toBe(true);
    const refreshed = await prisma.paymentBatch.findUnique({ where: { id: batch.id } });
    expect(refreshed?.status).toBe("PARTIAL");
  });

  it("marks timeouts after submission as needs verification and never auto-retries them", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const { batch } = await submitBatch(
      {
        name: "Timeout",
        workflow: "SAME_USER",
        clientSubmissionId: "55555555-5555-4555-8555-555555555555",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit" }],
      },
      admin.id,
    );

    global.fetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }) as typeof fetch;

    await processAvailableJobs("worker-1", 1);
    const operation = await prisma.paymentOperation.findFirst({ where: { batchId: batch.id } });
    expect(operation?.status).toBe("NEEDS_VERIFICATION");
    expect(isRetryEligible(operation!)).toBe(false);
    const retry = await retryFailedOperations(batch.id, admin.id);
    expect(retry.retried).toBe(0);
  });

  it("recovers queued work after a worker restart but leaves submitted unknowns unverified", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const { batch } = await submitBatch(
      {
        name: "Restart",
        workflow: "MIXED_ROWS",
        clientSubmissionId: "66666666-6666-4666-8666-666666666666",
        confirmation: true,
        rows: [
          { clientRowId: "a", panelId: panel.id, username: "john", amount: "10", method: "Admin Credit" },
          { clientRowId: "b", panelId: panel.id, username: "alex", amount: "11", method: "Admin Credit" },
        ],
      },
      admin.id,
    );
    const [first, second] = await prisma.paymentOperation.findMany({ where: { batchId: batch.id } });
    await prisma.paymentOperation.update({
      where: { id: first!.id },
      data: {
        status: "PROCESSING",
        claimedAt: new Date(Date.now() - 120_000),
        claimExpiresAt: new Date(Date.now() - 10_000),
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        operationId: first!.id,
        outcome: "TIMEOUT",
        submitted: true,
        requestFingerprint: "x",
      },
    });
    await prisma.paymentOperation.update({
      where: { id: second!.id },
      data: {
        status: "PROCESSING",
        claimedAt: new Date(Date.now() - 120_000),
        claimExpiresAt: new Date(Date.now() - 10_000),
      },
    });

    await recoverStaleClaims();
    const recovered = await prisma.paymentOperation.findMany({ where: { batchId: batch.id } });
    expect(recovered.find((item) => item.id === first!.id)?.status).toBe("NEEDS_VERIFICATION");
    expect(recovered.find((item) => item.id === second!.id)?.status).toBe("QUEUED");
  });

  it("does not retry completed payments and can cancel remaining queued rows", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const { batch } = await submitBatch(
      {
        name: "Cancel",
        workflow: "MIXED_ROWS",
        clientSubmissionId: "77777777-7777-4777-8777-777777777777",
        confirmation: true,
        rows: [
          { clientRowId: "a", panelId: panel.id, username: "john", amount: "10", method: "Admin Credit" },
          { clientRowId: "b", panelId: panel.id, username: "alex", amount: "11", method: "Admin Credit" },
        ],
      },
      admin.id,
    );
    await prisma.paymentOperation.updateMany({
      where: { batchId: batch.id, username: "john" },
      data: { status: "COMPLETED", lastAttemptOutcome: "SUCCESS" },
    });
    const cancelled = await cancelQueuedOperations(batch.id, admin.id, "stop remaining");
    expect(cancelled.cancelled).toBe(1);
    const completed = await prisma.paymentOperation.findFirst({ where: { batchId: batch.id, username: "john" } });
    expect(completed?.status).toBe("COMPLETED");
    expect(isRetryEligible(completed!)).toBe(false);
  });

  it("keeps API keys encrypted and decryptable only on the server", async () => {
    const panel = await createPanel("Secure");
    expect(panel.encryptedApiKey.startsWith("enc:")).toBe(true);
    expect(panel.encryptedApiKey).not.toContain("panel-admin-key-123456");
    expect(decryptSecret(panel.encryptedApiKey)).toBe("panel-admin-key-123456");
    expect(encryptSecret("abc")).not.toBe("abc");
  });

  it("claims at most one worker per operation", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A", { concurrencyLimit: 1 });
    await submitBatch(
      {
        name: "Claim",
        workflow: "SAME_USER",
        clientSubmissionId: "88888888-8888-4888-8888-888888888888",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit" }],
      },
      admin.id,
    );
    const first = await claimNextOperation("w1");
    const second = await claimNextOperation("w2");
    expect(first?.claimedBy).toBe("w1");
    expect(second).toBeNull();
  });

  it("summarizes currency-specific batch totals", async () => {
    const summary = summarizeBatch([
      { status: "COMPLETED", amount: "10", currency: "USD" },
      { status: "FAILED", amount: "5", currency: "USD" },
      { status: "COMPLETED", amount: "20", currency: "EUR" },
    ]);
    expect(summary.requested).toEqual({ USD: "15", EUR: "20" });
    expect(summary.confirmed).toEqual({ USD: "10", EUR: "20" });
    expect(summary.counts.failed).toBe(1);
  });

  it("handles missing API keys as a failed connection rather than a fabricated success", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Broken", {
      encryptedApiKey: encryptSecret("short"),
    });
    const { batch } = await submitBatch(
      {
        name: "Bad key",
        workflow: "SAME_USER",
        clientSubmissionId: "99999999-9999-4999-8999-999999999999",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit" }],
      },
      admin.id,
    );
    global.fetch = vi.fn(async () => jsonResponse({ error_code: 401, error_message: "Invalid API key" }, 401)) as typeof fetch;
    await processAvailableJobs("worker-1", 1);
    const operation = await prisma.paymentOperation.findFirst({ where: { batchId: batch.id } });
    expect(operation?.status).toBe("FAILED");
    expect(operation?.remotePaymentId).toBeNull();
  });

  it("does not execute an unclaimed operation", async () => {
    const panel = await createPanel("Panel A");
    const admin = await createAdmin();
    const { batch } = await submitBatch(
      {
        name: "No claim",
        workflow: "SAME_USER",
        clientSubmissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        confirmation: true,
        rows: [{ clientRowId: "row-1", panelId: panel.id, username: "john", amount: "12", method: "Admin Credit" }],
      },
      admin.id,
    );
    await expect(executeOperation(batch.operations[0]!.id)).rejects.toThrow(/not claimed/);
  });
});
