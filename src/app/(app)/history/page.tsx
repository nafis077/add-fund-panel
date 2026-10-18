"use client";

import { useEffect, useState } from "react";
import { useActivePanel } from "@/components/active-panel-provider";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Segmented } from "@/components/segmented";
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
  const { activePanelId, setActivePanelId } = useActivePanel();
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    void api<{ panels: Array<{ id: string; name: string }> }>("/api/panels").then((payload) => {
      setPanels(payload.panels);
    });
  }, []);

  useEffect(() => {
    if (activePanelId) {
      setFilters((current) => ({ ...current, panelId: activePanelId }));
    }
  }, [activePanelId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filters.panelId]);

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
        title="History"
        description="Local operations are the durable ledger for every Add Funds attempt."
        actions={
          <button className="btn-secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "local", label: "Local" },
            { value: "remote", label: "Remote" },
          ]}
        />
      </div>
      <div className="mb-3 md:hidden">
        <button className="btn-secondary w-full" onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? "Hide filters" : "Filters"}
        </button>
      </div>
      <div className={`card mb-4 grid gap-3 p-4 md:grid-cols-4 ${filtersOpen ? "" : "max-md:hidden"}`}>
        <select
          className="field"
          value={filters.panelId}
          onChange={(event) => {
            setFilters({ ...filters, panelId: event.target.value });
            if (event.target.value) setActivePanelId(event.target.value);
          }}
        >
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
          Apply
        </button>
      </div>
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      {tab === "local" ? (
        <>
          <div className="mobile-cards">
            {local.length === 0 ? (
              <div className="card">
                <EmptyState title="No payments yet" body="After you confirm Add Funds, attempts appear here." />
              </div>
            ) : null}
            {local.map((item) => (
              <button key={item.id} type="button" className="mobile-item text-left" onClick={() => setSelected(item)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.username}</p>
                    <p className="muted">{item.panel.name}</p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>
                <p className="mt-2 text-lg font-semibold">
                  <MoneyText amount={item.amount} currency={item.currency} />
                </p>
                <p className="muted mt-1">{item.method}</p>
                {item.errorMessage ? <p className="mt-2 text-sm text-rose-300">{item.errorMessage}</p> : null}
              </button>
            ))}
          </div>
          <div className="card desktop-table p-4">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Panel</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Remote ID</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {local.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted py-6">
                        No local payments yet.
                      </td>
                    </tr>
                  ) : null}
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
                      <td className="max-w-xs truncate text-rose-300">{item.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mobile-cards">
            {remote.length === 0 ? (
              <div className="card">
                <EmptyState title="No remote rows" body="Pick a panel and apply filters." />
              </div>
            ) : null}
            {remote.map((item) => (
              <div key={item.id} className="mobile-item">
                <p className="font-mono text-xs">{item.id}</p>
                <p className="mt-1 font-semibold">{item.username ?? "—"}</p>
                <p className="muted mt-1">
                  {item.amount && item.currency ? <MoneyText amount={item.amount} currency={item.currency} /> : item.amount}
                </p>
                <p className="mt-2">{item.status}</p>
              </div>
            ))}
          </div>
          <div className="card desktop-table p-4">
            <div className="table-wrap">
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
            </div>
          </div>
        </>
      )}

      {selected ? (
        <div className="sheet-scrim" onClick={() => setSelected(null)}>
          <aside className="card sheet" onClick={(event) => event.stopPropagation()}>
            <p className="page-kicker">Transaction</p>
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
            <button className="btn-secondary mt-6 w-full" onClick={() => setSelected(null)}>
              Close
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
