"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MoneyText, TotalsText } from "@/components/money-text";
import { api } from "@/lib/client";

type Operation = {
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
  lastAttemptOutcome: string | null;
  panel: { name: string };
};

type Batch = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  createdBy: { name: string };
  approvedBy?: { name: string } | null;
  operations: Operation[];
  summary: {
    progress: number;
    counts: Record<string, number>;
    requested: Record<string, string>;
    confirmed: Record<string, string>;
  };
};

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const payload = await api<{ batch: Batch }>(`/api/batches/${params.id}`);
    setBatch(payload.batch);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!batch) return <p className="muted">Loading batch…</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Batch"
        title={batch.name}
        description={`Created by ${batch.createdBy.name} on ${new Date(batch.createdAt).toLocaleString()}`}
        actions={
          <>
            <a className="btn-secondary" href={`/api/batches/${batch.id}/export`}>
              Export CSV
            </a>
            <button
              className="btn-secondary"
              onClick={() => void api(`/api/batches/${batch.id}/retry`, { method: "POST" }).then(load)}
            >
              Retry safe failures
            </button>
            <button
              className="btn-secondary"
              onClick={() => void api(`/api/batches/${batch.id}/cancel`, { method: "POST", body: "{}" }).then(load)}
            >
              Cancel queued
            </button>
            {batch.status === "PENDING_APPROVAL" ? (
              <button
                className="btn-primary"
                onClick={() =>
                  void api(`/api/batches/${batch.id}/approve`, { method: "POST" })
                    .then(load)
                    .catch((error) => setMessage(error instanceof Error ? error.message : "Approval failed"))
                }
              >
                Approve
              </button>
            ) : null}
          </>
        }
      />
      <div className="mb-5 flex items-center gap-3">
        <StatusBadge value={batch.status} />
        <span className="muted">{batch.summary.progress}% complete</span>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(batch.summary.counts).map(([key, value]) => (
          <div key={key} className="card p-4">
            <p className="muted capitalize">{key.replaceAll(/[A-Z]/g, (char) => ` ${char}`)}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="card mt-4 p-4 text-sm">
        Requested <TotalsText totals={batch.summary.requested} /> · Confirmed <TotalsText totals={batch.summary.confirmed} />
        {batch.approvedBy ? <span className="muted"> · Approved by {batch.approvedBy.name}</span> : null}
      </div>
      {message ? <p className="mt-3 text-sm text-rose-300">{message}</p> : null}
      <div className="card mt-4 p-4">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Panel</th>
                <th>Username</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Payment ID</th>
                <th>Balance</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batch.operations.map((operation) => (
                <tr key={operation.id}>
                  <td>{operation.panel.name}</td>
                  <td>{operation.username}</td>
                  <td>
                    <MoneyText amount={operation.amount} currency={operation.currency} />
                  </td>
                  <td>{operation.method}</td>
                  <td>
                    <StatusBadge value={operation.status} />
                  </td>
                  <td className="font-mono">{operation.remotePaymentId ?? "—"}</td>
                  <td>{operation.remoteBalance ?? "—"}</td>
                  <td className="max-w-xs truncate">{operation.errorMessage ?? "—"}</td>
                  <td>
                    {operation.status === "NEEDS_VERIFICATION" ? (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          void api(`/api/operations/${operation.id}/reconcile`, { method: "POST", body: "{}" }).then((result) => {
                            setMessage(JSON.stringify(result));
                            return load();
                          })
                        }
                      >
                        Reconcile
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
