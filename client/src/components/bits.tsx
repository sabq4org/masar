import clsx from "clsx";
import type { StatusRow, TaskRow } from "../lib/types";
import { PRIORITY_LABELS } from "../lib/types";

export function StatusChip({ status }: { status?: StatusRow }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: status.color + "1f", color: status.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
      {status.nameAr}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  const p = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.normal;
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", p.cls)}>{p.label}</span>
  );
}

export function Avatar({ name, color, size = 7 }: { name: string; color: string; size?: number }) {
  return (
    <span
      title={name}
      className={clsx(
        "flex items-center justify-center rounded-full text-xs font-bold text-white",
        size === 7 ? "h-7 w-7" : "h-6 w-6",
      )}
      style={{ background: color }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function DueBadge({ task }: { task: TaskRow }) {
  if (!task.dueAt) return null;
  const due = new Date(task.dueAt);
  const doneCat = task.status?.category === "done" || task.status?.category === "closed";
  const now = new Date();
  const overdue = !doneCat && due < now;
  const today = due.toDateString() === now.toDateString();
  return (
    <span
      className={clsx(
        "text-xs font-semibold tabular-nums",
        overdue ? "text-red-600" : today ? "text-amber-700" : "text-ink-3",
      )}
    >
      {overdue && "متأخرة · "}
      {due.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
    </span>
  );
}
