import { describe, expect, it } from "vitest";
import { addTotals, formatTotals, mergeTotals, parseAmount } from "@/lib/money";

describe("currency totals", () => {
  it("never combines different currencies into one amount", () => {
    const totals = mergeTotals(addTotals({}, "USD", "50"), addTotals({}, "EUR", "25"), addTotals({}, "BDT", "1000"));
    expect(totals).toEqual({ USD: "50", EUR: "25", BDT: "1000" });
    expect(formatTotals(totals)).toContain("USD");
    expect(formatTotals(totals)).toContain("EUR");
    expect(formatTotals(totals)).toContain("BDT");
  });

  it("rejects invalid amounts", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12.5")?.toString()).toBe("12.5");
  });
});
