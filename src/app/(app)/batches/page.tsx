"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TotalsText } from "@/components/money-text";
import { api } from "@/lib/client";

type Batch = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  createdBy: { name: string };
  panels: Array<{ panel: { name: string } }>;
  summary: {
    progress: number;
    counts: { total: number; completed: number; failed: number; needsVerification: number; queued: number };
    requested: Record<string, string>;
    confirmed: Record<string, string>;
  };
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    void api<{ batches: Batch[] }>("/api/batches").then((payload) => setBatches(payload.batches));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Campaigns" title="Batch history" description="Each bulk submission is a named financial batch with currency-separated totals." />
      <div className="grid gap-4">
        {batches.length === 0 ? <div className="card p-6 muted">No batches yet.</div> : null}
        {batches.map((batch) => (
          <Link key={batch.id} href={`/batches/${batch.id}`} className="card p-5 hover:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium">{batch.name}</h3>
                <p className="muted">
                  {batch.createdBy.name} · {new Date(batch.createdAt).toLocaleString()} · {batch.panels.map((item) => item.panel.name).join(", ")}
                </p>
              </div>
              <StatusBadge value={batch.status} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
              <div>Total {batch.summary.counts.total}</div>
              <div>Completed {batch.summary.counts.completed}</div>
              <div>Failed {batch.summary.counts.failed}</div>
              <div>Needs verification {batch.summary.counts.needsVerification}</div>
            </div>
            <div className="mt-3 text-sm">
              Requested <TotalsText totals={batch.summary.requested} /> · Confirmed <TotalsText totals={batch.summary.confirmed} />
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/10">
              <div className="h-1.5 rounded-full bg-mint-400" style={{ width: `${batch.summary.progress}%` }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
