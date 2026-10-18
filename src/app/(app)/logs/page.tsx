"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/client";

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string;
  ipAddress: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
  batch: { id: string; name: string; status: string } | null;
};

type FailureItem = {
  id: string;
  username: string;
  status: string;
  errorMessage: string | null;
  lastAttemptOutcome: string | null;
  amount: string;
  currency: string;
  panel: { name: string };
  batch: { id: string; name: string };
  updatedAt: string;
};

function metadataText(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    if (keys.length === 0) return "—";
    return keys
      .slice(0, 4)
      .map((key) => `${key}: ${typeof parsed[key] === "object" ? JSON.stringify(parsed[key]) : String(parsed[key])}`)
      .join(" · ");
  } catch {
    return raw || "—";
  }
}

export default function ActivityLogPage() {
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const payload = await api<{ audit: AuditItem[]; failures: FailureItem[] }>("/api/activity");
      setAudit(payload.audit);
      setFailures(payload.failures);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Activity log"
        description="Every add-funds submit, API attempt, retry, and failure is recorded here. Railway deploy logs only show server boot messages — payment errors live on this page."
        actions={
          <button className="btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

      <div className="card mb-6 p-5">
        <h3 className="font-medium">Payment errors</h3>
        <p className="muted mt-1">Failed and needs-verification credits from Add Funds.</p>
        {failures.length === 0 ? <p className="muted mt-4">No failed payments yet.</p> : null}
        <div className="mt-4 space-y-3">
          {failures.map((item) => (
            <Link key={item.id} href={`/batches/${item.batch.id}`} className="block rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>
                  {item.panel.name} · {item.username}
                </strong>
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-1 text-sm">
                {item.currency} {item.amount}
                {item.lastAttemptOutcome ? ` · ${item.lastAttemptOutcome}` : ""}
              </p>
              <p className="mt-1 text-sm text-rose-300">{item.errorMessage ?? "No error message stored"}</p>
              <p className="muted mt-1">{item.batch.name}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-medium">Audit trail</h3>
        <div className="table-wrap mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Batch</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted py-6">
                    No audit events yet. Confirm an Add Funds distribution to create the first log.
                  </td>
                </tr>
              ) : (
                audit.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td>{item.actor?.name ?? "system"}</td>
                    <td>
                      {item.batch ? (
                        <Link className="text-mint-400" href={`/batches/${item.batch.id}`}>
                          {item.batch.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-md truncate">{metadataText(item.metadata)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
