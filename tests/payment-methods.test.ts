import { describe, expect, it } from "vitest";
import {
  methodAllowedOnPanel,
  parsePaymentMethods,
  serializePaymentMethods,
} from "@/lib/validation";
import { previewPayments } from "@/server/payments";
import { createPanel, resetDb } from "./helpers";

describe("panel payment methods", () => {
  it("parses JSON, comma lists, and de-duplicates methods", () => {
    expect(parsePaymentMethods('["Admin Credit","PayPal"]')).toEqual(["Admin Credit", "PayPal"]);
    expect(parsePaymentMethods("Admin Credit, PayPal, admin credit")).toEqual(["Admin Credit", "PayPal"]);
    expect(parsePaymentMethods([])).toEqual(["Admin Credit"]);
    expect(serializePaymentMethods([" Bonus ", "Bonus"])).toBe('["Bonus"]');
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
});
