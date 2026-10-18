"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActivePanel } from "@/components/active-panel-provider";
import { ConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { Segmented } from "@/components/segmented";
import { StatusBadge } from "@/components/status-badge";
import { api, uid } from "@/lib/client";
import {
  DEFAULT_PAYMENT_METHOD,
  formatMethodChoice,
  parseCsv,
  parsePaymentMethodOptions,
  type PaymentMethodOption,
} from "@/lib/validation";
import type { PaymentRowInput, PreviewIssue, Workflow } from "@/types/domain";

type Panel = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
  paymentMethods: Array<string | PaymentMethodOption>;
};

function panelMethodsList(panel?: Panel | null): PaymentMethodOption[] {
  return parsePaymentMethodOptions(panel?.paymentMethods);
}

function firstPanelMethod(panel?: Panel | null) {
  return panelMethodsList(panel)[0]?.apiName ?? DEFAULT_PAYMENT_METHOD;
}

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

function emptyRow(panelId = "", method = DEFAULT_PAYMENT_METHOD): PaymentRowInput {
  return {
    clientRowId: uid(),
    panelId,
    username: "",
    amount: "",
    method,
    memo: "",
    affiliateCommission: false,
  };
}

export function FundsWorkspace({ mode }: { mode: "simple" | "bulk" }) {
  const router = useRouter();
  const { activePanelId, setActivePanelId } = useActivePanel();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>(mode === "simple" ? "SAME_USER" : "MIXED_ROWS");
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [panelMethods, setPanelMethods] = useState<Record<string, string>>({});
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
      setPanelMethods(
        Object.fromEntries(payload.panels.map((panel) => [panel.id, firstPanelMethod(panel)])),
      );
      const defaults = payload.panels.filter((panel) => panel.isDefault && panel.isActive).map((panel) => panel.id);
      const fromTopBar = activePanelId && payload.panels.some((panel) => panel.id === activePanelId) ? [activePanelId] : [];
      const initial = fromTopBar.length
        ? fromTopBar
        : defaults.length
          ? defaults
          : payload.panels.filter((panel) => panel.isActive).slice(0, 1).map((p) => p.id);
      setSelectedPanels(initial);
      if (payload.panels[0] && rows.length === 1 && !rows[0].panelId) {
        const startPanel = payload.panels.find((panel) => panel.id === initial[0]) ?? payload.panels[0];
        setRows([emptyRow(startPanel.id, firstPanelMethod(startPanel))]);
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
        method: panelMethods[panelId] ?? firstPanelMethod(panels.find((panel) => panel.id === panelId)),
        memo,
        affiliateCommission: affiliate,
      }));
    }
    return rows;
  }, [workflow, selectedPanels, username, amount, panelMethods, memo, affiliate, rows, submissionId, panels]);

  useEffect(() => {
    if (!activePanelId) return;
    setSelectedPanels((current) => (current.includes(activePanelId) ? current : [activePanelId]));
    setRows((current) => {
      const panel = panels.find((item) => item.id === activePanelId);
      if (current.length === 1) {
        return [{ ...current[0], panelId: activePanelId, method: firstPanelMethod(panel) }];
      }
      return current;
    });
  }, [activePanelId, panels]);

  function togglePanel(id: string) {
    setSelectedPanels((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      const preferred = next.includes(id) ? id : next[0];
      if (preferred) setActivePanelId(preferred);
      return next;
    });
    setPanelMethods((current) => {
      if (current[id]) return current;
      const panel = panels.find((item) => item.id === id);
      return { ...current, [id]: firstPanelMethod(panel) };
    });
  }

  function updateRow(id: string, patch: Partial<PaymentRowInput>) {
    setRows((current) =>
      current.map((row) => {
        if (row.clientRowId !== id) return row;
        if (patch.panelId && patch.panelId !== row.panelId) {
          const nextPanel = panels.find((panel) => panel.id === patch.panelId);
          setActivePanelId(patch.panelId);
          return { ...row, ...patch, method: firstPanelMethod(nextPanel) };
        }
        return { ...row, ...patch };
      }),
    );
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
        eyebrow={mode === "simple" ? "Credit" : "Campaign"}
        title={mode === "simple" ? "Add Funds" : "Bulk Distribution"}
        description="Credits go through each panel Admin API. Nothing is written to a remote panel database."
      />

      <div className="mb-5">
        <Segmented
          value={workflow}
          onChange={setWorkflow}
          options={[
            { value: "SAME_USER", label: "Same user" },
            { value: "MIXED_ROWS", label: "Different users" },
          ]}
        />
      </div>

      <div className="card p-4 sm:p-5">
        <label className="field-label">
          Batch name
          <input
            className="field"
            value={batchName}
            placeholder="October user bonus"
            onChange={(event) => setBatchName(event.target.value)}
          />
        </label>

        {workflow === "SAME_USER" ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="field-label">Panels</p>
              <div className="mt-2 grid gap-2">
                {panels.map((panel) => {
                  const on = selectedPanels.includes(panel.id);
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      className={on ? "panel-pick panel-pick-on" : "panel-pick"}
                      onClick={() => togglePanel(panel.id)}
                    >
                      <span>
                        <span className="block font-semibold">{panel.name}</span>
                        <span className="muted">{panel.currency}</span>
                      </span>
                      <StatusBadge value={panel.connectionStatus} />
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field-label">
              Username
              <input className="field" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="field-label">
              Amount
              <input className="field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {selectedPanels.map((panelId) => {
              const panel = panels.find((item) => item.id === panelId);
              const methods = panelMethodsList(panel);
              return (
                <label key={panelId} className="field-label">
                  Method{selectedPanels.length > 1 ? ` · ${panel?.name ?? "panel"}` : ""}
                  <select
                    className="field"
                    value={panelMethods[panelId] ?? methods[0]?.apiName ?? DEFAULT_PAYMENT_METHOD}
                    onChange={(event) => setPanelMethods((current) => ({ ...current, [panelId]: event.target.value }))}
                  >
                    {methods.map((item) => (
                      <option key={item.apiName} value={item.apiName}>
                        {formatMethodChoice(item)}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            <label className="field-label">
              Memo
              <input className="field" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={affiliate} onChange={(event) => setAffiliate(event.target.checked)} />
              Affiliate commission
            </label>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  const panel = panels.find((item) => item.id === (selectedPanels[0] ?? panels[0]?.id)) ?? panels[0];
                  setRows((current) => [...current, emptyRow(panel?.id, firstPanelMethod(panel))]);
                }}
              >
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
                        <select className="field" value={row.method} onChange={(event) => updateRow(row.clientRowId, { method: event.target.value })}>
                          {panelMethodsList(panels.find((panel) => panel.id === row.panelId)).map((item) => (
                            <option key={item.apiName} value={item.apiName}>
                              {formatMethodChoice(item)}
                            </option>
                          ))}
                          {row.method &&
                          !panelMethodsList(panels.find((panel) => panel.id === row.panelId)).some(
                            (item) => item.apiName === row.method,
                          ) ? (
                            <option value={row.method}>{row.method} (not on panel)</option>
                          ) : null}
                        </select>
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
        <p className="muted mt-4 max-md:hidden">
          After confirm, credits go to the panel Admin API. Status is on Activity Log, History, and Batches.
        </p>
        <div className="sticky-action">
          <button className="btn-primary w-full md:w-auto" onClick={() => void openConfirm()} disabled={busy}>
            {busy ? "Checking…" : "Review"}
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
