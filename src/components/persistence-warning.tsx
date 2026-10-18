"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  storage?: { engine: string; persistent: boolean; message: string };
};

export function PersistenceWarning() {
  const [storage, setStorage] = useState<Health["storage"]>();

  useEffect(() => {
    void fetch("/api/health", { credentials: "include" })
      .then((response) => response.json())
      .then((payload: Health) => setStorage(payload.storage))
      .catch(() => undefined);
  }, []);

  if (!storage || storage.persistent) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
      <p className="font-medium text-amber-200">Panel data will disappear on the next deploy</p>
      <p className="muted mt-1">{storage.message}</p>
    </div>
  );
}
