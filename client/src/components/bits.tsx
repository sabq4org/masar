import clsx from "clsx";
import { Check, Diamond, ThumbsUp } from "lucide-react";
import type { Priority, TaskRow } from "../lib/types";
import { PRIORITIES } from "../lib/types";
import { dueLabel, dueTone } from "../lib/dates";

export function Avatar({
  name,
  color,
  size = 7,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const px = { 5: "h-5 w-5 text-[10px]", 6: "h-6 w-6 text-xs", 7: "h-7 w-7 text-xs", 8: "h-8 w-8 text-sm", 9: "h-9 w-9 text-sm", 12: "h-12 w-12 text-lg" }[size] ?? "h-7 w-7 text-xs";
  return (
    <span
      title={name}
      className={clsx("flex flex-none select-none items-center justify-center rounded-chip font-bold text-paper", px)}
      style={{ background: color }}
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

/** زر الإكمال الدائري — نموذج أسانا: دائرة بعلامة ✓ تمتلئ بالأخضر عند الإكمال */
export function CheckCircle({
  checked,
  onToggle,
  size = 18,
  milestone,
  className,
}: {
  checked: boolean;
  onToggle?: (next: boolean) => void;
  size?: number;
  milestone?: boolean;
  className?: string;
}) {
  const base = clsx(
    "flex flex-none items-center justify-center border transition-all duration-150",
    milestone ? "rotate-45 rounded-[4px]" : "rounded-chip",
    checked
      ? "border-success bg-success text-paper"
      : "border-ink-3/60 bg-transparent text-ink-3/70 hover:border-success hover:text-success",
    onToggle ? "cursor-pointer" : "cursor-default",
    className,
  );
  return (
    <button
      type="button"
      aria-label={checked ? "إلغاء الإكمال" : "إكمال المهمة"}
      title={checked ? "مكتملة — اضغط للتراجع" : "وضع علامة الإكمال"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.(!checked);
      }}
      className={base}
      style={{ width: size, height: size }}
    >
      <span className={milestone ? "-rotate-45" : undefined}>
        <Check size={size - 7} strokeWidth={3} />
      </span>
    </button>
  );
}

/** شارة الأولوية — أقراص ملونة بأسلوب حقول أسانا */
export function PriorityPill({ priority, size = "sm" }: { priority: Priority | null; size?: "sm" | "xs" }) {
  if (!priority) return null;
  const p = PRIORITIES[priority];
  if (!p) return null;
  return (
    <span
      className={clsx(
        "inline-flex flex-none items-center rounded-chip font-bold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]",
      )}
      style={{ background: p.bg, color: p.fg }}
    >
      {p.label}
    </span>
  );
}

export function DueText({ task, className }: { task: TaskRow; className?: string }) {
  if (!task.dueAt) return null;
  return (
    <span
      className={clsx(
        "flex-none text-xs font-semibold tabular-nums",
        dueTone(task.dueAt, task.isCompleted),
        className,
      )}
    >
      {dueLabel(task.dueAt)}
    </span>
  );
}

export function ProjectDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block flex-none rounded-[3px]"
      style={{ background: color, width: size, height: size }}
    />
  );
}

export function MilestoneIcon({ size = 14 }: { size?: number }) {
  return <Diamond size={size} className="flex-none text-review" fill="currentColor" />;
}

export function LikeCount({ count, liked }: { count: number; liked?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        liked ? "text-saffron" : "text-ink-3",
      )}
    >
      <ThumbsUp size={11} />
      {count}
    </span>
  );
}

/** شريط خطأ عائم موحد */
export function ErrorBar({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-1/2 z-[100] translate-x-1/2 rounded-field border border-danger/30 bg-surface px-4 py-2 text-sm font-semibold text-danger shadow-card">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-ink-3">جارٍ التحميل…</div>
  );
}
