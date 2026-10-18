import { processAvailableJobs } from "@/server/queue";

const workerId = `worker_${process.pid}_${Math.random().toString(16).slice(2)}`;
const pollMs = Number(process.env.WORKER_POLL_MS ?? 750);

async function loop() {
  try {
    await processAvailableJobs(workerId, 5);
  } catch (error) {
    console.error("[worker] tick failed", error instanceof Error ? error.message : "unknown");
  } finally {
    setTimeout(() => {
      void loop();
    }, pollMs);
  }
}

if (process.argv[1]?.includes("worker")) {
  console.info(`[worker] started ${workerId}`);
  void loop();
}

export { loop as startWorkerLoop, workerId };
