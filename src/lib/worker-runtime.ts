let started = false;

export function ensureWorker(): void {
  if (started) return;
  if (process.env.DISABLE_INPROCESS_WORKER === "1") return;
  if (typeof window !== "undefined") return;
  started = true;
  const pollMs = Number(process.env.WORKER_POLL_MS ?? 750);
  const workerId = `inprocess_${process.pid}`;

  const tick = async () => {
    const { processAvailableJobs } = await import("@/server/queue");
    await processAvailableJobs(workerId, 5);
  };

  void tick().catch((error) => {
    console.error("[worker] startup tick failed", error instanceof Error ? error.message : error);
  });
  setInterval(() => {
    void tick().catch((error) => {
      console.error("[worker] tick failed", error instanceof Error ? error.message : error);
    });
  }, pollMs);
}
