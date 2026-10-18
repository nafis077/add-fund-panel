import Decimal from "decimal.js";
import type { CurrencyTotals } from "@/types/domain";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);

export function assertAmount(raw: string | number): Decimal {
  const value = new Decimal(typeof raw === "number" ? raw.toString() : raw.trim());
  if (!value.isFinite() || value.lte(0)) {
    throw new Error("Amount must be a number greater than zero");
  }
  if (value.decimalPlaces() > 8) {
    throw new Error("Amount cannot have more than 8 decimal places");
  }
  return value;
}

export function parseAmount(raw: string | number): Decimal | null {
  try {
    return assertAmount(raw);
  } catch {
    return null;
  }
}

export function normalizeAmount(raw: string | number): string {
  return assertAmount(raw).toFixed();
}

export function formatMoney(amount: string | number, currency: string): string {
  const value = new Decimal(amount || 0);
  const digits = ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
  const formatted = value.toFixed(Math.min(Math.max(value.decimalPlaces(), digits), 8));
  return `${currency} ${formatted}`;
}

export function addTotals(totals: CurrencyTotals, currency: string, amount: string | number): CurrencyTotals {
  const next = { ...totals };
  const current = new Decimal(next[currency] ?? "0");
  next[currency] = current.plus(amount).toFixed();
  return next;
}

export function emptyTotals(): CurrencyTotals {
  return {};
}

export function mergeTotals(...groups: CurrencyTotals[]): CurrencyTotals {
  return groups.reduce<CurrencyTotals>((acc, group) => {
    for (const [currency, amount] of Object.entries(group)) {
      acc = addTotals(acc, currency, amount);
    }
    return acc;
  }, {});
}

export function compareAmount(amount: string, threshold: string): number {
  return new Decimal(amount).comparedTo(new Decimal(threshold));
}

export function totalsExceed(totals: CurrencyTotals, threshold: string, currency: string): boolean {
  const value = totals[currency];
  if (!value) return false;
  return compareAmount(value, threshold) >= 0;
}

export function formatTotals(totals: CurrencyTotals): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "0";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

export function serializeTotals(totals: CurrencyTotals): string {
  return JSON.stringify(totals);
}

export function parseTotals(raw: string | null | undefined): CurrencyTotals {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CurrencyTotals;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
