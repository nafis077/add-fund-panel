"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActivePanel } from "@/components/active-panel-provider";
import { EmptyState } from "@/components/empty-state";
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
  const { activePanelId, activePanel } = useActivePanel();
  const [data, setData] = useState<Dashboard | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (activePanelId) params.set("panelId", activePanelId);
    setData(await api<Dashboard>(`/api/dashboard?${params}`));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanelId]);

  if (!data) {
    return (
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card stat-card h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const metrics = [
    ["Today", data.cards.transactionsToday, ""],
    ["Completed", data.cards.completed, ""],
    ["Failed", data.cards.failed, "stat-rose"],
    ["Needs check", data.cards.needsVerification, "stat-amber"],
    ["Panels", data.cards.totalPanels, ""],
    ["Active", data.cards.activePanels, ""],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Home"
        description={
          activePanel
            ? `Showing ${activePanel.name}. Switch panels from the top bar.`
            : "Live totals stay separated by currency."
        }
      />

      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="field-label">
          From
          <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field-label">
          To
          <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="btn-secondary self-end" onClick={() => void load()}>
          Apply
        </button>
      </div>

      <div className="stat-grid">
        <div className="card stat-card stat-hero">
          <p className="stat-kicker muted">Total fund added</p>
          <p className="stat-value">
            <TotalsText totals={data.cards.fundsAdded} empty="No credits yet" />
          </p>
        </div>
        {metrics.map(([label, value, tone]) => (
          <div key={label} className={`card stat-card ${tone}`}>
            <p className="stat-kicker muted">{label}</p>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-medium">Activity</h3>
          <div className="h-56">
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
          <h3 className="mb-4 font-medium">Volume by panel</h3>
          <div className="h-56">
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
          <h3 className="mb-3 font-medium">Latest credits</h3>
          {data.recentCompleted.length === 0 ? (
            <EmptyState
              title="No credits yet"
              body="Send the first one from Add Funds."
              action={
                <Link className="btn-primary" href="/funds">
                  Add funds
                </Link>
              }
            />
          ) : null}
          {data.recentCompleted.map((item) => (
            <p key={item.id} className="border-t border-white/5 py-2 text-sm">
              {item.panel.name} · {item.username} · {item.currency} {item.amount}
            </p>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-medium">Recent failures</h3>
          {data.recentFailed.length === 0 ? <EmptyState title="No failures" body="Failed credits will show here." /> : null}
          {data.recentFailed.map((item) => (
            <p key={item.id} className="border-t border-white/5 py-2 text-sm">
              {item.panel.name} · {item.username}
              <span className="muted block">{item.errorMessage}</span>
            </p>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-medium">Active batches</h3>
          {data.activeBatches.length === 0 ? <EmptyState title="Nothing in flight" /> : null}
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
