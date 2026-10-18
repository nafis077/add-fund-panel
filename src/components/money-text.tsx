import { formatMoney, formatTotals } from "@/lib/money";
import type { CurrencyTotals } from "@/types/domain";

export function MoneyText({ amount, currency }: { amount: string | number; currency: string }) {
  return <span className="font-mono tabular-nums">{formatMoney(amount, currency)}</span>;
}

export function TotalsText({ totals, empty = "—" }: { totals: CurrencyTotals; empty?: string }) {
  const text = formatTotals(totals);
  return <span className="font-mono tabular-nums">{text === "0" ? empty : text}</span>;
}
