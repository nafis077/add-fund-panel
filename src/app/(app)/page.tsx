"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TotalsText } from "@/components/money-text";
import { api } from "@/lib/client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Dashboard = {
  cards: {
    totalPanels: number;
    activePanels: number;
    fundsAdded: Record<string, string>;
    transactionsToday: number;
    completed: number;
    failed: number;
    needsVerification: number;
  };
  charts: {
    daily: Array<{ date: string; completed: number; failed: number }>;
    volumeByPanel: Array<{ name: string; completed: number }>;
    successVsFailed: Array<{ name: string; value: number }>;
  };
  recentCompleted: Array<{ id: string; username: string; amount: string; currency: string; panel: { name: string } }>;
  recentFailed: Array<{ id: string; username: string; errorMessage: string | null; panel: { name: string } }>;
  activeBatches: Array<{ id: string; name: string; status: string; summary: { progress: number; counts: { total: number } } }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setData(await api<Dashboard>(`/api/dashboard?${params}`));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <p className="muted">Loading treasury snapshot…</p>;

  const cards = [
    ["Total panels", data.cards.totalPanels],
    ["Active panels", data.cards.activePanels],
    ["Transactions today", data.cards.transactionsToday],
    ["Completed", data.cards.completed],
    ["Failed", data.cards.failed],
    ["Needs verification", data.cards.needsVerification],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Fund operations dashboard"
        description="Live totals stay separated by currency. Remote credits only appear as completed after a confirmed Admin API response."
        actions={
          <>
            <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <button className="btn-secondary" onClick={() => void load()}>
              Apply
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="card p-5 md:col-span-2">
          <p className="muted">Total fund added</p>
          <p className="mt-2 text-3xl font-semibold">
            <TotalsText totals={data.cards.fundsAdded} empty="No confirmed credits" />
          </p>
        </div>
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-medium">Payment activity over time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.daily}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis dataKey="date" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#34d399" />
                <Line type="monotone" dataKey="failed" stroke="#fb7185" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-medium">Payment volume by panel</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.volumeByPanel}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis dataKey="name" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip />
                <Bar dataKey="completed" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-3 font-medium">Latest fund additions</h3>
          {data.recentCompleted.length === 0 ? <p className="muted">No completed credits yet.</p> : null}
          {data.recentCompleted.map((item) => (
            <p key={item.id} className="border-t border-white/5 py-2 text-sm">
              {item.panel.name} · {item.username} · {item.currency} {item.amount}
            </p>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-medium">Recent failures</h3>
          {data.recentFailed.length === 0 ? <p className="muted">No failed operations.</p> : null}
          {data.recentFailed.map((item) => (
            <p key={item.id} className="border-t border-white/5 py-2 text-sm">
              {item.panel.name} · {item.username}
              <span className="muted block">{item.errorMessage}</span>
            </p>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-medium">Active batches</h3>
          {data.activeBatches.length === 0 ? <p className="muted">No batches in flight.</p> : null}
          {data.activeBatches.map((batch) => (
            <a key={batch.id} href={`/batches/${batch.id}`} className="block border-t border-white/5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span>{batch.name}</span>
                <StatusBadge value={batch.status} />
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-mint-400" style={{ width: `${batch.summary.progress}%` }} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
