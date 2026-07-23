import clsx from "clsx";
import type { StatusRow, TaskRow } from "../lib/types";

export function StatusChip({ status }: { status?: StatusRow }) {
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-chip px-2.5 py-0.5 text-xs font-bold"
      style={{ background: status.color + "1f", color: status.color }}
    >
      <span className="h-1.5 w-1.5 rounded-chip" style={{ background: status.color }} />
      {status.nameAr}
    </span>
  );
}

/** الأولوية بشكل النقطة لا بلون جديد: عاجل ◆ زعفران نابض • مهم ● حبر • عادي ○ • منخفض ◌ */
export function PriorityChip({ priority }: { priority: string }) {
  const P: Record<string, { label: string; dot: React.ReactNode }> = {
    urgent: {
      label: "عاجل",
      dot: (
        <span className="masar-urgent-dot inline-block h-2 w-2 rotate-45 bg-saffron" />
      ),
    },
    high: {
      label: "مهم",
      dot: <span className="inline-block h-2 w-2 rounded-chip bg-ink" />,
    },
    normal: {
      label: "عادي",
      dot: <span className="inline-block h-2 w-2 rounded-chip border-[1.5px] border-ink-2" />,
    },
    low: {
      label: "منخفض",
      dot: (
        <span className="inline-block h-2 w-2 rounded-chip border border-dashed border-ink-3" />
      ),
    },
  };
  const p = P[priority] ?? P.normal;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
      {p.dot}
      {p.label}
    </span>
  );
}

export function Avatar({ name, color, size = 7 }: { name: string; color: string; size?: number }) {
  return (
    <span
      title={name}
      className={clsx(
        "flex items-center justify-center rounded-chip text-xs font-bold text-paper",
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
        overdue ? "text-danger" : today ? "text-wait" : "text-ink-3",
      )}
    >
      {overdue && "متأخرة · "}
      {due.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
    </span>
  );
}
