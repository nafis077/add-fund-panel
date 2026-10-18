import { describe, expect, it } from "vitest";
import {
  formatMethodChoice,
  methodAllowedOnPanel,
  parsePaymentMethodOptions,
  parsePaymentMethods,
  resolvePaymentMethod,
  serializePaymentMethods,
} from "@/lib/validation";
import { previewPayments } from "@/server/payments";
import { updatePanel } from "@/server/panels";
import { createAdmin, createPanel, resetDb } from "./helpers";

describe("panel payment methods", () => {
  it("parses JSON, comma lists, and de-duplicates methods", () => {
    expect(parsePaymentMethods('["Admin Credit","PayPal"]')).toEqual(["Admin Credit", "PayPal"]);
    expect(parsePaymentMethods("Admin Credit, PayPal, admin credit")).toEqual(["Admin Credit", "PayPal"]);
    expect(parsePaymentMethods([])).toEqual(["Admin Credit"]);
    expect(serializePaymentMethods([" Bonus ", "Bonus"])).toBe('[{"apiName":"Bonus","label":"Bonus"}]');
  });

  it("keeps an API name and a display name", () => {
    const methods = parsePaymentMethodOptions('[{"apiName":"manual","label":"USDT"}]');
    expect(methods).toEqual([{ apiName: "manual", label: "USDT" }]);
    expect(formatMethodChoice(methods[0])).toBe("USDT (manual)");
    expect(resolvePaymentMethod("USDT", methods)).toBe("manual");
    expect(resolvePaymentMethod("manual", methods)).toBe("manual");
    expect(methodAllowedOnPanel("usdt", methods)).toBe(true);
  });

  it("reads legacy string methods as matching API and display names", () => {
    expect(parsePaymentMethodOptions(["Admin Credit"])).toEqual([
      { apiName: "Admin Credit", label: "Admin Credit" },
    ]);
  });

  it("rejects a method that is not enabled on the selected panel", async () => {
    await resetDb();
    const panel = await createPanel("Panel A", { paymentMethods: '["Bonus"]' });
    const preview = await previewPayments([
      { clientRowId: "1", panelId: panel.id, username: "john", amount: "10", method: "PayPal" },
    ]);
    expect(methodAllowedOnPanel("Bonus", panel.paymentMethods)).toBe(true);
    expect(preview.issues.some((issue) => issue.code === "unknown_method")).toBe(true);
  });

  it("sends the API name when the admin selected the display name", async () => {
    await resetDb();
    const panel = await createPanel("Panel A", {
      paymentMethods: '[{"apiName":"manual","label":"USDT"}]',
    });
    const preview = await previewPayments([
      { clientRowId: "1", panelId: panel.id, username: "john", amount: "10", method: "USDT" },
    ]);
    expect(preview.issues.some((issue) => issue.code === "unknown_method")).toBe(false);
    expect(preview.rows[0]?.method).toBe("manual");
  });

  it("updates panel methods without requiring a new API key", async () => {
    await resetDb();
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const updated = await updatePanel(panel.id, { paymentMethods: ["PayPal", "Bonus"], apiKey: "" }, admin.id);
    expect(updated.paymentMethods).toEqual([
      { apiName: "PayPal", label: "PayPal" },
      { apiName: "Bonus", label: "Bonus" },
    ]);
  });

  it("saves a display name next to the API method", async () => {
    await resetDb();
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    const updated = await updatePanel(
      panel.id,
      { paymentMethods: [{ apiName: "manual", label: "USDT" }], apiKey: "" },
      admin.id,
    );
    expect(updated.paymentMethods).toEqual([{ apiName: "manual", label: "USDT" }]);
  });
});
