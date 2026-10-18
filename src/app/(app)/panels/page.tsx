"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  return (
    <span className="grid min-w-[7rem] gap-0.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs">
      <span>
        <span className="muted">API </span>
        {method.apiName}
      </span>
      <span>
        <span className="muted">Shown </span>
        {method.label || method.apiName}
      </span>
    </span>
  );
}

export default function PanelsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    const paymentMethods = preparedMethods(form.paymentMethods);
    if (!paymentMethods.length) {
      setError("Add at least one payment method for this panel");
      return;
    }
    try {
      const payload = { ...form, paymentMethods, apiKey: form.apiKey.trim() || undefined };
      if (editing) {
        await api(`/api/panels/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/panels", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(emptyForm());
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Panel management"
        title="Panel Management"
        description="Set each panel's API method name and the shown name you type and pick later. API keys stay encrypted."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form
          ref={formRef}
          id="panel-form"
          className="card order-1 p-5"
          onSubmit={(event) => void save(event)}
        >
          <h3 className="font-medium">{editing ? "Edit panel" : "Add panel"}</h3>
          <label className="field-label mt-4">
            Name
            <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field-label mt-3">
            Base API URL
            <input className="field" placeholder="https://smmxpanel.com" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
          </label>
          <label className="field-label mt-3">
            Admin API key
            <input className="field" type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
          </label>
          <label className="field-label mt-3">
            Currency
            <input className="field" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
          </label>
          <div className="mt-3">
            <p className="text-sm font-medium">Payment methods</p>
            <p className="muted mt-1 text-xs">
              Type the API name and the shown name in separate boxes. API name is sent to the panel
              (for example <code>manual</code>). Shown name is what you pick on Add Funds (for example{" "}
              <code>USDT</code>).
            </p>
            <div className="mt-3 space-y-3">
              {form.paymentMethods.map((method) => (
                <div key={method.rowId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <label className="field-label">
                    API name
                    <input
                      className="field"
                      placeholder="manual"
                      value={method.apiName}
                      onChange={(event) => updatePaymentMethod(method.rowId, "apiName", event.target.value)}
                    />
                  </label>
                  <label className="field-label mt-3">
                    Shown name
                    <input
                      className="field"
                      placeholder="USDT"
                      value={method.label}
                      onChange={(event) => updatePaymentMethod(method.rowId, "label", event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-secondary mt-3 w-full"
                    onClick={() => removePaymentMethod(method.rowId)}
                  >
                    Remove method
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary mt-3 w-full" onClick={addPaymentMethod}>
              Add method
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
            Default panel
          </label>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
          <button className="btn-primary mt-4 w-full">{editing ? "Update panel" : "Save panel"}</button>
        </form>

        <div className="card order-2 p-5">
          <div className="mb-4 flex gap-2">
            <input className="field" placeholder="Search panels" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn-secondary" onClick={() => void load()}>
              Filter
            </button>
          </div>
          <div className="mobile-cards mb-4">
            {panels.length === 0 ? (
              <EmptyState title="No panels yet" body="Add the first panel in the form above." />
            ) : null}
            {panels.map((panel) => (
              <div key={panel.id} className="mobile-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-secondary" onClick={() => startEdit(panel)}>
                    Edit
                  </button>
                  <button
                    className="btn-secondary"
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
                </div>
              </div>
            ))}
          </div>
          <div className="table-wrap desktop-table">
            <table className="data">
              <thead>
                <tr>
                  <th>Panel</th>
                  <th>Status</th>
                  <th>API / Shown</th>
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
                        {parsePaymentMethodOptions(panel.paymentMethods).map((method) => (
                          <MethodNames key={method.apiName} method={method} />
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
                      <button className="btn-secondary w-full" onClick={() => startEdit(panel)}>
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
