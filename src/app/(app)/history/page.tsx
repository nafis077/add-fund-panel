"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MoneyText } from "@/components/money-text";
import { api } from "@/lib/client";

type LocalItem = {
  id: string;
  internalTxnId: string;
  username: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  remotePaymentId: string | null;
  remoteBalance: string | null;
  errorMessage: string | null;
  executionMs: number | null;
  panel: { name: string };
  batch: { id: string; name: string };
};

type RemoteItem = {
  id: string;
  username: string | null;
  amount: string | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  memo: string | null;
  createdAt: string | null;
  localOperation: { id: string; batchId: string; status: string } | null;
};

export default function HistoryPage() {
  const [tab, setTab] = useState<"local" | "remote">("local");
  const [panels, setPanels] = useState<Array<{ id: string; name: string }>>([]);
  const [local, setLocal] = useState<LocalItem[]>([]);
  const [remote, setRemote] = useState<RemoteItem[]>([]);
  const [filters, setFilters] = useState({
    panelId: "",
    username: "",
    paymentId: "",
    method: "",
    status: "",
    from: "",
    to: "",
  });
  const [selected, setSelected] = useState<LocalItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ panels: Array<{ id: string; name: string }> }>("/api/panels").then((payload) => {
      setPanels(payload.panels);
    });
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError("");
    try {
      if (tab === "local") {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const payload = await api<{ items: LocalItem[] }>(`/api/history/local?${params}`);
        setLocal(payload.items);
      } else {
        if (!filters.panelId) {
          setError("Select a panel to load remote payment history");
          return;
        }
        const params = new URLSearchParams({
          panelId: filters.panelId,
          username: filters.username,
          ids: filters.paymentId,
          method: filters.method,
          payment_status: filters.status,
          created_from: filters.from,
          created_to: filters.to,
          limit: "100",
        });
        const payload = await api<{ items: RemoteItem[] }>(`/api/history/remote?${params}`);
        setRemote(payload.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "History request failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Audit trail"
        title="Payment history"
        description="Local operations are the durable ledger. Remote history is fetched live from each panel and linked when a payment ID matches."
        actions={
          <button className="btn-secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        }
      />
      <div className="mb-4 flex gap-2">
        <button className={tab === "local" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("local")}>
          Local operations
        </button>
        <button className={tab === "remote" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("remote")}>
          Remote panel history
        </button>
      </div>
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-4">
        <select className="field" value={filters.panelId} onChange={(event) => setFilters({ ...filters, panelId: event.target.value })}>
          <option value="">All panels</option>
          {panels.map((panel) => (
            <option key={panel.id} value={panel.id}>
              {panel.name}
            </option>
          ))}
        </select>
        <input className="field" placeholder="Username" value={filters.username} onChange={(event) => setFilters({ ...filters, username: event.target.value })} />
        <input className="field" placeholder="Payment ID" value={filters.paymentId} onChange={(event) => setFilters({ ...filters, paymentId: event.target.value })} />
        <input className="field" placeholder="Method" value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })} />
        <input className="field" placeholder="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} />
        <input className="field" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <input className="field" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <button className="btn-secondary" onClick={() => void refresh()}>
          Apply filters
        </button>
      </div>
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}
      <div className="card p-4">
        <div className="table-wrap">
          {tab === "local" ? (
            <table className="data">
              <thead>
                <tr>
                  <th>Panel</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Remote ID</th>
                </tr>
              </thead>
              <tbody>
                {local.map((item) => (
                  <tr key={item.id} className="cursor-pointer" onClick={() => setSelected(item)}>
                    <td>{item.panel.name}</td>
                    <td>{item.username}</td>
                    <td>
                      <MoneyText amount={item.amount} currency={item.currency} />
                    </td>
                    <td>{item.method}</td>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="font-mono">{item.remotePaymentId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Remote ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Linked local operation</th>
                </tr>
              </thead>
              <tbody>
                {remote.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono">{item.id}</td>
                    <td>{item.username}</td>
                    <td>
                      {item.amount && item.currency ? <MoneyText amount={item.amount} currency={item.currency} /> : item.amount}
                    </td>
                    <td>{item.status}</td>
                    <td>
                      {item.localOperation ? (
                        <a className="text-mint-400" href={`/batches/${item.localOperation.batchId}`}>
                          {item.localOperation.status}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setSelected(null)}>
          <aside className="card h-full w-full max-w-md overflow-y-auto rounded-none p-6" onClick={(event) => event.stopPropagation()}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-mint-400">Transaction details</p>
            <h3 className="mt-2 text-xl font-semibold">{selected.username}</h3>
            <div className="mt-4 space-y-2 text-sm">
              <p>Panel: {selected.panel.name}</p>
              <p>
                Amount: <MoneyText amount={selected.amount} currency={selected.currency} />
              </p>
              <p>Method: {selected.method}</p>
              <p>Status: {selected.status}</p>
              <p>Internal ID: {selected.internalTxnId}</p>
              <p>API payment ID: {selected.remotePaymentId ?? "—"}</p>
              <p>Updated balance: {selected.remoteBalance ?? "—"}</p>
              <p>Execution: {selected.executionMs ? `${selected.executionMs} ms` : "—"}</p>
              <p>Error: {selected.errorMessage ?? "—"}</p>
              <a className="text-mint-400" href={`/batches/${selected.batch.id}`}>
                Open batch {selected.batch.name}
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
