export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INPROCESS_WORKER === "1") return;
  const { startWorkerLoop } = await import("@/worker");
  void startWorkerLoop();
}
