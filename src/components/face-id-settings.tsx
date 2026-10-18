"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import {
  biometricLabel,
  disableFaceId,
  enableFaceId,
  faceIdAvailable,
  faceIdStatus,
} from "@/lib/face-id";

export function FaceIdSettings() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void faceIdStatus().then((status) => setEnabled(status.enabled));
    void faceIdAvailable().then(setAvailable);
  }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (enabled) {
        await disableFaceId();
        setEnabled(false);
        setMessage("Face ID unlock is off on this device.");
      } else {
        await enableFaceId();
        setEnabled(true);
        setMessage("Face ID unlock is on for this device.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Face ID");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-medium">
            <ScanFace size={18} />
            Unlock with Face ID
          </h3>
          <p className="muted mt-1">
            Saved on this phone only, not in the database. After you leave the app, it asks for Face ID again.
          </p>
          {!available ? (
            <p className="muted mt-2">
              Use Safari on iPhone (or the Home Screen shortcut) to enable Face ID. Chrome on iPhone cannot do this.
            </p>
          ) : null}
        </div>
        <button className="btn-primary" disabled={busy || (!available && !enabled)} onClick={() => void toggle()}>
          {busy ? "Waiting…" : enabled ? "Turn off Face ID" : biometricLabel().replace("Unlock", "Enable")}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
    </div>
  );
}
