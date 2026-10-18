"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { PersistenceWarning } from "@/components/persistence-warning";
import { ThemeToggle } from "@/components/theme-toggle";
import { biometricLabel, faceIdStatus, markUnlocked, unlockWithFaceId } from "@/lib/face-id";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@localhost");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      setError(payload.error ?? "Unable to sign in");
      return;
    }
    markUnlocked();
    window.location.assign(params.get("next") || "/");
  }

  useEffect(() => {
    void faceIdStatus()
      .then((status) => setFaceIdEnabled(status.enabled))
      .catch(() => undefined);
  }, []);

  async function unlockFaceId() {
    setBusy(true);
    setError("");
    try {
      await unlockWithFaceId();
      window.location.assign(params.get("next") || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face ID unlock failed");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-6">
      <div className="absolute right-4 top-4" style={{ top: "max(1rem, env(safe-area-inset-top))" }}>
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-md space-y-4">
        <form onSubmit={(event) => void onSubmit(event)} className="card w-full p-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-mint-400">Panel Treasury</p>
        <h1 className="mt-2 text-2xl font-semibold">Administrator sign in</h1>
        <p className="muted mt-2">Centralized fund control for connected SMM panels.</p>
        <label className="mt-6 block text-sm text-slate-300">
          Email
          <input className="field mt-1" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm text-slate-300">
          Password
          <input
            className="field mt-1"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {faceIdEnabled ? (
            <button
              type="button"
              className="btn-secondary mt-2 w-full"
              disabled={busy}
              onClick={() => void unlockFaceId()}
            >
              {busy ? "Waiting for Face ID…" : biometricLabel()}
            </button>
          ) : null}
        </form>
        <PersistenceWarning />
        <InstallAppPrompt />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
