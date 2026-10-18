"use client";

import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TotalsText } from "@/components/money-text";
import { api, uid } from "@/lib/client";
import { parsePaymentMethodOptions, type PaymentMethodOption } from "@/lib/validation";

type MethodDraft = PaymentMethodOption & { rowId: string };

type Panel = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  connectionStatus: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  concurrencyLimit: number;
  minRequestIntervalMs: number;
  paymentMethods: Array<string | PaymentMethodOption>;
  createdAt: string;
  updatedAt: string;
  totalTransactions: number;
  fundsAdded: Record<string, string>;
};

function methodDraft(method: PaymentMethodOption): MethodDraft {
  return { rowId: uid(), apiName: method.apiName, label: method.label };
}

function emptyForm() {
  return {
    name: "",
    baseUrl: "",
    apiKey: "",
    currency: "USD",
    isDefault: false,
    concurrencyLimit: 2,
    minRequestIntervalMs: 250,
    paymentMethods: [methodDraft({ apiName: "Admin Credit", label: "Admin Credit" })],
  };
}

function preparedMethods(methods: MethodDraft[]): PaymentMethodOption[] {
  const seen = new Set<string>();
  const result: PaymentMethodOption[] = [];
  for (const method of methods) {
    const apiName = method.apiName.trim();
    if (!apiName) continue;
    const key = apiName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ apiName, label: method.label.trim() || apiName });
  }
  return result;
}

function MethodNames({ method }: { method: PaymentMethodOption }) {
  const shown = method.label || method.apiName;
  return (
    <span className="chip">
      {shown}
      {shown.toLowerCase() !== method.apiName.toLowerCase() ? (
        <span className="muted ml-1 font-normal">· {method.apiName}</span>
      ) : null}
    </span>
  );
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[] | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function addPaymentMethod() {
    setForm((current) => ({
      ...current,
      paymentMethods: [...current.paymentMethods, methodDraft({ apiName: "", label: "" })],
    }));
  }

  function updatePaymentMethod(rowId: string, field: "apiName" | "label", value: string) {
    setForm((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.map((item) =>
        item.rowId === rowId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function removePaymentMethod(rowId: string) {
    setForm((current) => {
      const paymentMethods = current.paymentMethods.filter((item) => item.rowId !== rowId);
      return {
        ...current,
        paymentMethods: paymentMethods.length ? paymentMethods : [methodDraft({ apiName: "", label: "" })],
      };
    });
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setError("");
  }

  function startAdd() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function startEdit(panel: Panel) {
    setEditing(panel.id);
    setForm({
      name: panel.name,
      baseUrl: panel.baseUrl,
      apiKey: "",
      currency: panel.currency,
      isDefault: panel.isDefault,
      concurrencyLimit: panel.concurrencyLimit,
      minRequestIntervalMs: panel.minRequestIntervalMs,
      paymentMethods: parsePaymentMethodOptions(panel.paymentMethods).map(methodDraft),
    });
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  async function load(search = query) {
    const payload = await api<{ panels: Panel[] }>(`/api/panels?q=${encodeURIComponent(search)}`);
    setPanels(payload.panels);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(query);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const paymentMethods = preparedMethods(form.paymentMethods);
    if (!paymentMethods.length) {
      setError("Add at least one payment method");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, paymentMethods, apiKey: form.apiKey.trim() || undefined };
      if (editing) {
        await api(`/api/panels/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Panel updated");
      } else {
        await api("/api/panels", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Panel saved");
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testPanel(panel: Panel) {
    setError("");
    try {
      const result = await api<{ test: { message: string } }>(`/api/panels/${panel.id}/test`, { method: "POST" });
      setMessage(result.test.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    }
  }

  const list = panels ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Connections"
        title="Panel Management"
        description="Add a panel, then type the API name and the shown name for each method."
        actions={
          <button className="btn-primary" onClick={startAdd}>
            Add panel
          </button>
        }
      />

      {message ? <p className="notice-ok mb-4">{message}</p> : null}
      {error && !formOpen ? <p className="notice-bad mb-4">{error}</p> : null}

      <div className="card p-4 sm:p-5">
        <input
          className="field"
          placeholder="Search panels"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {panels === null ? <p className="muted mt-4">Loading panels…</p> : null}
        {panels && list.length === 0 ? (
          <EmptyState title="No panels yet" body="Tap Add panel to connect the first one." />
        ) : null}

        <div className="mobile-cards mt-4">
          {list.map((panel) => (
            <div key={panel.id} className="mobile-item">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{panel.name}</p>
                  <p className="muted break-all">{panel.baseUrl}</p>
                </div>
                <StatusBadge value={panel.connectionStatus} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {parsePaymentMethodOptions(panel.paymentMethods).map((method) => (
                  <MethodNames key={method.apiName} method={method} />
                ))}
              </div>
              <p className="muted mt-3">
                {panel.totalTransactions} tx · <TotalsText totals={panel.fundsAdded} />
              </p>
              <div className="action-row mt-3">
                <button className="btn-primary" onClick={() => startEdit(panel)}>
                  Edit
                </button>
                <button className="btn-secondary" onClick={() => void testPanel(panel)}>
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="table-wrap desktop-table mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>Panel</th>
                <th>Status</th>
                <th>Methods</th>
                <th>Key</th>
                <th>Activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((panel) => (
                <tr key={panel.id}>
                  <td>
                    <strong>{panel.name}</strong>
                    <p className="muted">{panel.baseUrl}</p>
                  </td>
                  <td className="space-y-1">
                    <StatusBadge value={panel.connectionStatus} />
                    <div>
                      <StatusBadge value={panel.isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>
                  </td>
                  <td>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {parsePaymentMethodOptions(panel.paymentMethods).map((method) => (
                        <MethodNames key={method.apiName} method={method} />
                      ))}
                    </div>
                  </td>
                  <td className="font-mono">{panel.apiKeyMasked}</td>
                  <td>
                    {panel.totalTransactions} tx
                    <p className="muted">
                      <TotalsText totals={panel.fundsAdded} />
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className="btn-primary" onClick={() => startEdit(panel)}>
                        Edit
                      </button>
                      <button className="btn-secondary" onClick={() => void testPanel(panel)}>
                        Test
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          void api(`/api/panels/${panel.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ isActive: !panel.isActive }),
                          }).then(() => load())
                        }
                      >
                        {panel.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => {
                          if (confirm(`Delete ${panel.name}?`)) {
                            void api(`/api/panels/${panel.id}`, { method: "DELETE" }).then(() => load());
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen ? (
        <div className="sheet-scrim" onClick={closeForm}>
          <form className="card sheet" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void save(event)}>
            <p className="page-kicker">{editing ? "Edit" : "New"}</p>
            <h3 className="mt-1 text-xl font-semibold">{editing ? "Edit panel" : "Add panel"}</h3>
            <label className="field-label mt-4">
              Name
              <input className="field" placeholder="Demo Panel" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-label mt-3">
              Base API URL
              <input className="field" placeholder="https://smmxpanel.com" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
            </label>
            <label className="field-label mt-3">
              Admin API key
              <input
                className="field"
                type="password"
                placeholder={editing ? "Leave blank to keep the current key" : "Paste the Admin API key"}
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              />
            </label>
            <label className="field-label mt-3">
              Currency
              <input className="field" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
            </label>
            <div className="mt-4">
              <p className="text-sm font-semibold">Payment methods</p>
              <p className="muted mt-1 text-xs">API name goes to the panel. Shown name is what you pick on Add Funds.</p>
              <div className="mt-3 space-y-3">
                {form.paymentMethods.map((method, index) => (
                  <div key={method.rowId} className="method-box">
                    <div className="method-grid">
                      <label className="field-label">
                        API name
                        <input
                          className="field"
                          placeholder="manual"
                          value={method.apiName}
                          onChange={(event) => updatePaymentMethod(method.rowId, "apiName", event.target.value)}
                        />
                      </label>
                      <label className="field-label">
                        Shown name
                        <input
                          className="field"
                          placeholder="USDT"
                          value={method.label}
                          onChange={(event) => updatePaymentMethod(method.rowId, "label", event.target.value)}
                        />
                      </label>
                    </div>
                    {form.paymentMethods.length > 1 || index > 0 ? (
                      <button type="button" className="btn-secondary mt-2 w-full" onClick={() => removePaymentMethod(method.rowId)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button type="button" className="btn-secondary mt-3 w-full" onClick={addPaymentMethod}>
                Add method
              </button>
            </div>
            <label className="check-row mt-4">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
              Default panel
            </label>
            {error ? <p className="notice-bad mt-3">{error}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
