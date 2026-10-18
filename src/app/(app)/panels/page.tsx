"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TotalsText } from "@/components/money-text";
import { api } from "@/lib/client";

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
  paymentMethods: string[];
  createdAt: string;
  updatedAt: string;
  totalTransactions: number;
  fundsAdded: Record<string, string>;
};

const emptyForm = {
  name: "",
  baseUrl: "",
  apiKey: "",
  currency: "USD",
  isDefault: false,
  concurrencyLimit: 2,
  minRequestIntervalMs: 250,
  paymentMethods: ["Admin Credit"],
};

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [methodDraft, setMethodDraft] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function addPaymentMethod() {
    const method = methodDraft.trim();
    if (!method) return;
    setForm((current) => {
      const exists = current.paymentMethods.some((item) => item.toLowerCase() === method.toLowerCase());
      return exists ? current : { ...current, paymentMethods: [...current.paymentMethods, method] };
    });
    setMethodDraft("");
  }

  function removePaymentMethod(method: string) {
    setForm((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.filter((item) => item !== method),
    }));
  }

  async function load() {
    const payload = await api<{ panels: Panel[] }>(`/api/panels?q=${encodeURIComponent(query)}`);
    setPanels(payload.panels);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.paymentMethods.length) {
      setError("Add at least one payment method for this panel");
      return;
    }
    try {
      if (editing) {
        await api(`/api/panels/${editing}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await api("/api/panels", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Connections"
        title="Panel management"
        description="API keys are encrypted at rest and never returned to the browser. Use a test against GET /adminapi/v2/payments."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form className="card p-5" onSubmit={(event) => void save(event)}>
          <h3 className="font-medium">{editing ? "Edit panel" : "Add panel"}</h3>
          <label className="mt-4 block text-sm">
            Name
            <input className="field mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="mt-3 block text-sm">
            Base API URL
            <input className="field mt-1" placeholder="https://smmxpanel.com" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
          </label>
          <label className="mt-3 block text-sm">
            Admin API key
            <input className="field mt-1" type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
          </label>
          <label className="mt-3 block text-sm">
            Currency
            <input className="field mt-1" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
          </label>
          <div className="mt-3">
            <p className="text-sm">Payment methods</p>
            <p className="muted mt-1 text-xs">Add the exact method names this panel accepts in Admin API v2.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.paymentMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs"
                  onClick={() => removePaymentMethod(method)}
                >
                  {method} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="field"
                placeholder="e.g. Admin Credit, PayPal, Bonus"
                value={methodDraft}
                onChange={(event) => setMethodDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPaymentMethod();
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={addPaymentMethod}>
                Add
              </button>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
            Default panel
          </label>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
          <button className="btn-primary mt-4 w-full">{editing ? "Update panel" : "Save panel"}</button>
        </form>

        <div className="card p-5">
          <div className="mb-4 flex gap-2">
            <input className="field" placeholder="Search panels" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn-secondary" onClick={() => void load()}>
              Filter
            </button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Panel</th>
                  <th>Status</th>
                  <th>Methods</th>
                  <th>Key</th>
                  <th>Transactions</th>
                  <th>Funds added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panels.map((panel) => (
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
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {(panel.paymentMethods ?? []).map((method) => (
                          <span key={method} className="rounded-full border border-white/10 px-2 py-0.5 text-xs">
                            {method}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="font-mono">{panel.apiKeyMasked}</td>
                    <td>{panel.totalTransactions}</td>
                    <td>
                      <TotalsText totals={panel.fundsAdded} />
                    </td>
                    <td className="space-y-2">
                      <button
                        className="btn-secondary w-full"
                        onClick={() =>
                          void api<{ test: { message: string } }>(`/api/panels/${panel.id}/test`, { method: "POST" })
                            .then((result) => {
                              setMessage(result.test.message);
                              return load();
                            })
                            .catch((err) => setError(err instanceof Error ? err.message : "Test failed"))
                        }
                      >
                        Test
                      </button>
                      <button
                        className="btn-secondary w-full"
                        onClick={() => {
                          setEditing(panel.id);
                          setForm({
                            name: panel.name,
                            baseUrl: panel.baseUrl,
                            apiKey: "",
                            currency: panel.currency,
                            isDefault: panel.isDefault,
                            concurrencyLimit: panel.concurrencyLimit,
                            minRequestIntervalMs: panel.minRequestIntervalMs,
                            paymentMethods: panel.paymentMethods?.length ? panel.paymentMethods : ["Admin Credit"],
                          });
                          setMethodDraft("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-secondary w-full"
                        onClick={() =>
                          void api(`/api/panels/${panel.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ isActive: !panel.isActive }),
                          }).then(load)
                        }
                      >
                        {panel.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn-danger w-full"
                        onClick={() => {
                          if (confirm(`Delete ${panel.name}?`)) {
                            void api(`/api/panels/${panel.id}`, { method: "DELETE" }).then(load);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
