"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";

type Settings = {
  highValueApprovalEnabled: boolean;
  highValueApprovalThreshold: string;
  highValueApprovalCurrency: string;
  defaultPaymentMethod: string;
  defaultMemo: string;
  requireSecondConfirmAbove: string;
};

type Admin = { id: string; email: string; name: string; role: string; isActive: boolean };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminForm, setAdminForm] = useState({ email: "", name: "", password: "", role: "OPERATOR" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<{ settings: Settings }>("/api/settings").then((payload) => setSettings(payload.settings));
    void api<{ users: Admin[] }>("/api/admins")
      .then((payload) => setAdmins(payload.users))
      .catch(() => setAdmins([]));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const payload = await api<{ settings: Settings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    setSettings(payload.settings);
    setMessage("Settings saved");
  }

  async function createAdmin(event: FormEvent) {
    event.preventDefault();
    const payload = await api<{ user: Admin }>("/api/admins", {
      method: "POST",
      body: JSON.stringify(adminForm),
    });
    setAdmins((current) => [...current, payload.user]);
    setAdminForm({ email: "", name: "", password: "", role: "OPERATOR" });
  }

  if (!settings) return <p className="muted">Loading settings…</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Controls"
        title="Settings"
        description="High-value batches can require a second administrator. API credentials stay encrypted and server-side only."
      />
      <form className="card grid gap-4 p-5 md:grid-cols-2" onSubmit={(event) => void save(event)}>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={settings.highValueApprovalEnabled}
            onChange={(event) => setSettings({ ...settings, highValueApprovalEnabled: event.target.checked })}
          />
          Require second-admin approval above threshold
        </label>
        <label className="text-sm">
          Approval threshold
          <input className="field mt-1" value={settings.highValueApprovalThreshold} onChange={(event) => setSettings({ ...settings, highValueApprovalThreshold: event.target.value })} />
        </label>
        <label className="text-sm">
          Threshold currency
          <input className="field mt-1" value={settings.highValueApprovalCurrency} onChange={(event) => setSettings({ ...settings, highValueApprovalCurrency: event.target.value })} />
        </label>
        <label className="text-sm">
          Extra confirm above
          <input className="field mt-1" value={settings.requireSecondConfirmAbove} onChange={(event) => setSettings({ ...settings, requireSecondConfirmAbove: event.target.value })} />
        </label>
        <label className="text-sm">
          Default payment method
          <input className="field mt-1" value={settings.defaultPaymentMethod} onChange={(event) => setSettings({ ...settings, defaultPaymentMethod: event.target.value })} />
        </label>
        <label className="text-sm md:col-span-2">
          Default memo
          <input className="field mt-1" value={settings.defaultMemo} onChange={(event) => setSettings({ ...settings, defaultMemo: event.target.value })} />
        </label>
        <div className="md:col-span-2">
          <button className="btn-primary">Save settings</button>
          {message ? <span className="ml-3 text-sm text-emerald-300">{message}</span> : null}
        </div>
      </form>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <form className="card p-5" onSubmit={(event) => void createAdmin(event)}>
          <h3 className="font-medium">Add administrator</h3>
          <input className="field mt-3" placeholder="Name" value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} />
          <input className="field mt-3" placeholder="Email" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} />
          <input className="field mt-3" type="password" placeholder="Password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} />
          <select className="field mt-3" value={adminForm.role} onChange={(event) => setAdminForm({ ...adminForm, role: event.target.value })}>
            <option>SUPER_ADMIN</option>
            <option>ADMIN</option>
            <option>OPERATOR</option>
            <option>VIEWER</option>
          </select>
          <button className="btn-primary mt-4">Create user</button>
        </form>
        <div className="card p-5">
          <h3 className="font-medium">Roles</h3>
          {admins.map((admin) => (
            <p key={admin.id} className="border-t border-white/5 py-2 text-sm">
              {admin.name} · {admin.email} · {admin.role}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
