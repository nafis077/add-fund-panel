const STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  CONNECTED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  QUEUED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  PROCESSING: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  FAILED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  NEEDS_VERIFICATION: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  CANCELLED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  PARTIAL: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  UNKNOWN: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  INACTIVE: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STYLES[value] ?? STYLES.UNKNOWN}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
