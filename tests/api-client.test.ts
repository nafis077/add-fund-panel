import { describe, expect, it } from "vitest";
import {
  addPanelPayment,
  buildInternalMemo,
  extractInternalTxnId,
  normalizeAddPaymentResponse,
  normalizePaymentList,
  validateAddPaymentRequest,
} from "@/lib/smm-admin-api";
import { adminApiUrl } from "@/lib/validation";

describe("SMM Admin API client", () => {
  it("builds panel-specific admin URLs instead of a hardcoded domain", () => {
    expect(adminApiUrl("https://panel-a.com", "/payments/add")).toBe(
      "https://panel-a.com/adminapi/v2/payments/add",
    );
    expect(adminApiUrl("https://panel-b.net/adminapi/v2/", "/payments")).toBe(
      "https://panel-b.net/adminapi/v2/payments",
    );
  });

  it("validates add-payment fields", () => {
    expect(() =>
      validateAddPaymentRequest({ username: "", amount: 12, method: "Admin Credit", affiliate_commission: false }),
    ).toThrow(/username/);
    expect(() =>
      validateAddPaymentRequest({ username: "john", amount: 0, method: "Admin Credit", affiliate_commission: false }),
    ).toThrow(/amount/);
  });

  it("only treats error_code 0 plus a payment id as completed", () => {
    const failed = normalizeAddPaymentResponse(200, { error_code: 0, message: "ok" }, true);
    expect(failed.ok).toBe(false);
    const ok = normalizeAddPaymentResponse(200, { error_code: 0, data: { id: 99, balance: "12.5" } }, true);
    expect(ok.ok).toBe(true);
    expect(ok.paymentId).toBe("99");
  });

  it("maps 429 to rate limited and timeout to unverified", async () => {
    const limited = normalizeAddPaymentResponse(429, { error_code: 1, error_message: "slow down" }, true);
    expect(limited.outcome).toBe("RATE_LIMITED");

    const result = await addPanelPayment(
      { baseUrl: "https://panel.example", apiKey: "secret-key" },
      { username: "john", amount: 12, method: "Admin Credit", affiliate_commission: false },
      {
        timeoutMs: 10,
        fetchImpl: () => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 5)),
      },
    );
    expect(result.outcome === "TIMEOUT" || result.outcome === "NETWORK").toBe(true);
    expect(result.ok).toBe(false);
  });

  it("normalizes remote payment history lists", () => {
    const list = normalizePaymentList({
      data: { list: [{ id: 1, username: "john", payment_status: "completed", amount: "12" }], total: 1 },
    });
    expect(list.items[0]?.status).toBe("completed");
    expect(extractInternalTxnId(buildInternalMemo("txn_1", "bonus"))).toBe("txn_1");
  });

});
