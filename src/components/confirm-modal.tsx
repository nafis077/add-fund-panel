"use client";

import { TotalsText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import type { CurrencyTotals, PreviewIssue } from "@/types/domain";

export function ConfirmModal({
  open,
  title,
  panelCount,
  recipientCount,
  transactionCount,
  totals,
  methods,
  issues,
  highValue,
  requiresApproval,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  panelCount: number;
  recipientCount: number;
  transactionCount: number;
  totals: CurrencyTotals;
  methods: string[];
  issues: PreviewIssue[];
  highValue: boolean;
  requiresApproval: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-xl p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-mint-400">Review before execution</p>
        <h3 className="mt-2 text-xl font-semibold">{title}</h3>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">Panels<br /><strong>{panelCount}</strong></div>
          <div className="rounded-xl bg-white/5 p-3">Recipients<br /><strong>{recipientCount}</strong></div>
          <div className="rounded-xl bg-white/5 p-3">Transactions<br /><strong>{transactionCount}</strong></div>
          <div className="rounded-xl bg-white/5 p-3">
            Total
            <br />
            <TotalsText totals={totals} />
          </div>
        </div>
        <p className="muted mt-4">Method: {methods.join(", ") || "Admin Credit"}</p>
        {requiresApproval ? (
          <p className="mt-3 text-sm text-amber-200">
            This batch exceeds the high-value threshold and will wait for a second administrator.
          </p>
        ) : null}
        {highValue ? (
          <p className="mt-2 text-sm text-orange-200">
            Confirm the full financial impact before sending funds to remote panels.
          </p>
        ) : null}
        {warnings.length > 0 ? (
          <div className="mt-4 space-y-1 text-sm text-amber-200">
            {warnings.map((issue) => (
              <p key={`${issue.rowId}-${issue.code}`}>Duplicate or warning: {issue.message}</p>
            ))}
          </div>
        ) : null}
        {errors.length > 0 ? (
          <div className="mt-4 space-y-1 text-sm text-rose-300">
            {errors.map((issue) => (
              <p key={`${issue.rowId}-${issue.code}`}>{issue.message}</p>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <StatusBadge value="QUEUED" />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            Back
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={busy || errors.length > 0}>
            {busy ? "Submitting…" : "Confirm and queue"}
          </button>
        </div>
      </div>
    </div>
  );
}
