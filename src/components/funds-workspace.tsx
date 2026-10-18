"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api, uid } from "@/lib/client";
import { parseCsv } from "@/lib/validation";
import type { PaymentRowInput, PreviewIssue, Workflow } from "@/types/domain";

type Panel = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
};

type Preview = {
  rows: Array<PaymentRowInput & { currency: string; panelName: string }>;
  issues: PreviewIssue[];
  panelCount: number;
  recipientCount: number;
  transactionCount: number;
  totals: Record<string, string>;
  requiresApproval: boolean;
  requiresSecondConfirm: boolean;
  methods: string[];
};

function emptyRow(panelId = ""): PaymentRowInput {
  return {
    clientRowId: uid(),
    panelId,
    username: "",
    amount: "",
    method: "Admin Credit",
    memo: "",
    affiliateCommission: false,
  };
}

export function FundsWorkspace({ mode }: { mode: "simple" | "bulk" }) {
  const router = useRouter();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>(mode === "simple" ? "SAME_USER" : "MIXED_ROWS");
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Admin Credit");
  const [memo, setMemo] = useState("");
  const [affiliate, setAffiliate] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [rows, setRows] = useState<PaymentRowInput[]>([emptyRow()]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState(uid());

  useEffect(() => {
    void api<{ panels: Panel[] }>("/api/panels").then((payload) => {
      setPanels(payload.panels);
      const defaults = payload.panels.filter((panel) => panel.isDefault && panel.isActive).map((panel) => panel.id);
      setSelectedPanels(defaults.length ? defaults : payload.panels.filter((panel) => panel.isActive).slice(0, 1).map((p) => p.id));
      if (payload.panels[0] && rows.length === 1 && !rows[0].panelId) {
        setRows([emptyRow(defaults[0] ?? payload.panels[0].id)]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const builtRows = useMemo(() => {
    if (workflow === "SAME_USER") {
      return selectedPanels.map((panelId) => ({
        clientRowId: `${submissionId}:${panelId}`,
        panelId,
        username,
        amount,
        method,
        memo,
        affiliateCommission: affiliate,
      }));
    }
    return rows;
  }, [workflow, selectedPanels, username, amount, method, memo, affiliate, rows, submissionId]);

  function togglePanel(id: string) {
    setSelectedPanels((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function updateRow(id: string, patch: Partial<PaymentRowInput>) {
    setRows((current) => current.map((row) => (row.clientRowId === id ? { ...row, ...patch } : row)));
  }

  async function openConfirm() {
    setError("");
    setBusy(true);
    try {
      const next = await api<Preview>("/api/funds/preview", {
        method: "POST",
        body: JSON.stringify({ rows: builtRows }),
      });
      setPreview(next);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ batch: { id: string } }>("/api/funds/submit", {
        method: "POST",
        body: JSON.stringify({
          name: batchName || `${new Date().toLocaleDateString()} fund distribution`,
          workflow,
          clientSubmissionId: submissionId,
          confirmation: true,
          rows: builtRows,
        }),
      });
      setConfirmOpen(false);
      setSubmissionId(uid());
      router.push(`/batches/${result.batch.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      const named = parsed.map((row) => {
        const match = panels.find(
          (panel) => panel.id === row.panelId || panel.name.toLowerCase() === row.panelId.toLowerCase(),
        );
        return { ...row, panelId: match?.id ?? row.panelId };
      });
      setWorkflow("MIXED_ROWS");
      setRows(named.length ? named : [emptyRow()]);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader
        eyebrow={mode === "simple" ? "Single or multi-panel credit" : "Campaign distribution"}
        title={mode === "simple" ? "Add Funds" : "Bulk Fund Distribution"}
        description="Credits are sent only through each panel's Admin API. Nothing is written to a remote panel database."
      />

      <div className="mb-5 flex gap-2">
        <button
          className={workflow === "SAME_USER" ? "btn-primary" : "btn-secondary"}
          onClick={() => setWorkflow("SAME_USER")}
        >
          Same username
        </button>
        <button
          className={workflow === "MIXED_ROWS" ? "btn-primary" : "btn-secondary"}
          onClick={() => setWorkflow("MIXED_ROWS")}
        >
          Different users
        </button>
      </div>

      <div className="card p-5">
        <label className="block text-sm text-slate-300">
          Batch name
          <input
            className="field mt-1"
            value={batchName}
            placeholder="October User Bonus Distribution"
            onChange={(event) => setBatchName(event.target.value)}
          />
        </label>

        {workflow === "SAME_USER" ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-sm text-slate-300">Select panels</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {panels.map((panel) => (
                  <label key={panel.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                    <span>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedPanels.includes(panel.id)}
                        onChange={() => togglePanel(panel.id)}
                      />
                      {panel.name}
                    </span>
                    <StatusBadge value={panel.connectionStatus} />
                  </label>
                ))}
              </div>
            </div>
            <label className="text-sm text-slate-300">
              Username
              <input className="field mt-1" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="text-sm text-slate-300">
              Amount
              <input className="field mt-1" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="text-sm text-slate-300">
              Payment method
              <input className="field mt-1" value={method} onChange={(event) => setMethod(event.target.value)} />
            </label>
            <label className="text-sm text-slate-300">
              Memo
              <input className="field mt-1" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={affiliate} onChange={(event) => setAffiliate(event.target.checked)} />
              Affiliate commission
            </label>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setRows((current) => [...current, emptyRow(selectedPanels[0] ?? panels[0]?.id)])}>
                Add row
              </button>
              <label className="btn-secondary cursor-pointer">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importCsv(file);
                  }}
                />
              </label>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Panel</th>
                    <th>Username</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Memo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.clientRowId}>
                      <td>
                        <select className="field" value={row.panelId} onChange={(event) => updateRow(row.clientRowId, { panelId: event.target.value })}>
                          <option value="">Select panel</option>
                          {panels.map((panel) => (
                            <option key={panel.id} value={panel.id}>
                              {panel.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input className="field" value={row.username} onChange={(event) => updateRow(row.clientRowId, { username: event.target.value })} />
                      </td>
                      <td>
                        <input className="field" value={row.amount} onChange={(event) => updateRow(row.clientRowId, { amount: event.target.value })} />
                      </td>
                      <td>
                        <input className="field" value={row.method} onChange={(event) => updateRow(row.clientRowId, { method: event.target.value })} />
                      </td>
                      <td>
                        <input className="field" value={row.memo ?? ""} onChange={(event) => updateRow(row.clientRowId, { memo: event.target.value })} />
                      </td>
                      <td className="space-x-2 whitespace-nowrap">
                        <button className="btn-secondary" onClick={() => setRows((current) => [...current, { ...row, clientRowId: uid() }])}>
                          Duplicate
                        </button>
                        <button className="btn-secondary" onClick={() => setRows((current) => current.filter((item) => item.clientRowId !== row.clientRowId))}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <p className="muted mt-4">
          After you confirm, this app sends the credit to the panel Admin API. Status and errors are on{" "}
          <a className="text-mint-400" href="/logs">
            Activity Log
          </a>
          ,{" "}
          <a className="text-mint-400" href="/history">
            Payment History
          </a>
          , and Batch History.
        </p>
        <div className="mt-6 flex justify-end">
          <button className="btn-primary" onClick={() => void openConfirm()} disabled={busy}>
            Review distribution
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Fund Distribution"
        panelCount={preview?.panelCount ?? 0}
        recipientCount={preview?.recipientCount ?? 0}
        transactionCount={preview?.transactionCount ?? 0}
        totals={preview?.totals ?? {}}
        methods={preview?.methods ?? []}
        issues={preview?.issues ?? []}
        highValue={Boolean(preview?.requiresSecondConfirm)}
        requiresApproval={Boolean(preview?.requiresApproval)}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}
