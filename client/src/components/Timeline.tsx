import { useMemo } from "react";
import type { TaskRow } from "../lib/types";

const DAY_W = 26;
const MS_DAY = 86400_000;

/** خط زمني خفيف: شريط لكل مهمة من البداية (أو الإنشاء) حتى الاستحقاق */
export default function Timeline({
  tasks,
  onOpen,
}: {
  tasks: TaskRow[];
  onOpen: (id: number) => void;
}) {
  const rows = useMemo(
    () =>
      tasks
        .filter((t) => t.dueAt)
        .map((t) => {
          const due = new Date(t.dueAt!);
          const start = t.startAt
            ? new Date(t.startAt)
            : new Date(Math.min(new Date(t.createdAt).getTime(), due.getTime() - MS_DAY));
          return { task: t, start, due };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [tasks],
  );

  const range = useMemo(() => {
    if (!rows.length) return null;
    const min = Math.min(...rows.map((r) => r.start.getTime()));
    const max = Math.max(...rows.map((r) => r.due.getTime()), Date.now());
    const from = new Date(min - 2 * MS_DAY);
    from.setHours(0, 0, 0, 0);
    const days = Math.ceil((max - from.getTime()) / MS_DAY) + 3;
    return { from, days };
  }, [rows]);

  if (!range)
    return (
      <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-3">
        لا مهام بمواعيد استحقاق لعرضها على الخط الزمني
      </div>
    );

  const x = (d: Date) => ((d.getTime() - range.from.getTime()) / MS_DAY) * DAY_W;
  const todayX = x(new Date());
  const width = range.days * DAY_W;

  // علامات الأيام (كل يومين لتخفيف الزحام)
  const ticks: Date[] = [];
  for (let i = 0; i < range.days; i += 2) {
    ticks.push(new Date(range.from.getTime() + i * MS_DAY));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex">
        {/* عمود العناوين */}
        <div className="w-48 flex-none border-l border-line">
          <div className="h-9 border-b border-line bg-line-soft/60" />
          {rows.map(({ task }) => (
            <button
              key={task.id}
              onClick={() => onOpen(task.id)}
              className="flex h-9 w-full items-center gap-1.5 truncate border-b border-line-soft px-2.5 text-right text-xs font-semibold hover:bg-line-soft/50"
              title={task.title}
            >
              {task.project && (
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: task.project.color }}
                />
              )}
              <span className="truncate">{task.title}</span>
            </button>
          ))}
        </div>
        {/* منطقة الأشرطة */}
        <div className="flex-1 overflow-x-auto" dir="ltr">
          <div className="relative" style={{ width }}>
            <div className="flex h-9 border-b border-line bg-line-soft/60">
              {ticks.map((d) => (
                <div
                  key={d.toISOString()}
                  className="absolute top-0 flex h-9 items-center border-l border-line-soft pl-1 text-[10px] tabular-nums text-ink-3"
                  style={{ left: x(d) }}
                >
                  {d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                </div>
              ))}
            </div>
            {/* خط اليوم */}
            {todayX > 0 && todayX < width && (
              <div
                className="absolute bottom-0 top-9 z-10 w-px bg-red-500"
                style={{ left: todayX }}
                title="اليوم"
              />
            )}
            {rows.map(({ task, start, due }) => {
              const left = x(start);
              const w = Math.max(x(due) - left, DAY_W * 0.8);
              const overdue =
                due < new Date() &&
                task.status?.category !== "done" &&
                task.status?.category !== "closed";
              return (
                <div key={task.id} className="relative h-9 border-b border-line-soft">
                  <button
                    onClick={() => onOpen(task.id)}
                    className="absolute top-1.5 h-6 rounded-md px-2 text-[10px] font-bold text-white shadow-sm transition hover:opacity-80"
                    style={{
                      left,
                      width: w,
                      background: task.status?.color ?? "#475569",
                      outline: overdue ? "2px solid #ef4444" : undefined,
                    }}
                    title={`${task.title} — ${task.status?.nameAr ?? ""}`}
                  >
                    <span className="block truncate" dir="rtl">{task.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
