"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { biometricLabel, clearUnlocked, faceIdStatus, isUnlocked, unlockWithFaceId } from "@/lib/face-id";

const IDLE_LOCK_MS = 20_000;

export function FaceLockGate({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void faceIdStatus()
      .then((status) => {
        setEnabled(status.enabled);
        if (status.enabled && !isUnlocked()) setLocked(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let hiddenAt = 0;
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= IDLE_LOCK_MS) {
        clearUnlocked();
        setLocked(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      await unlockWithFaceId();
      setLocked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  if (!locked) return children;

  return (
    <>
      <div className="pointer-events-none opacity-40">{children}</div>
      <div className="face-lock-overlay">
        <div className="card w-full max-w-sm p-6 text-center">
          <ScanFace className="mx-auto text-mint-400" size={40} />
          <h2 className="mt-3 text-xl font-semibold">Treasury is locked</h2>
          <p className="muted mt-2">Use Face ID, Touch ID, or your device biometrics to continue. Panel data is not changed.</p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <button className="btn-primary mt-5 w-full" disabled={busy} onClick={() => void unlock()}>
            {busy ? "Waiting for Face ID…" : biometricLabel()}
          </button>
          <button
            className="btn-secondary mt-2 w-full"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                window.location.assign("/login");
              });
            }}
          >
            Use password
          </button>
        </div>
      </div>
    </>
  );
}
