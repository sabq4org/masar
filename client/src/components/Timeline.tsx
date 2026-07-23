import { useMemo } from "react";
import type { TaskRow } from "../lib/types";
import { useTaskPane } from "../lib/taskPane";

const DAY_W = 26;
const MS_DAY = 86400_000;

/** الجدول الزمني: شريط لكل مهمة من البداية (أو الإنشاء) حتى الاستحقاق */
export default function Timeline({ tasks }: { tasks: TaskRow[] }) {
  const pane = useTaskPane();
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
      <div className="rounded-card border border-dashed border-line py-12 text-center text-sm text-ink-3">
        لا مهام بمواعيد استحقاق لعرضها على الجدول الزمني
      </div>
    );

  const x = (d: Date) => ((d.getTime() - range.from.getTime()) / MS_DAY) * DAY_W;
  const todayX = x(new Date());
  const width = range.days * DAY_W;

  const ticks: Date[] = [];
  for (let i = 0; i < range.days; i += 2) {
    ticks.push(new Date(range.from.getTime() + i * MS_DAY));
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex">
        {/* عمود العناوين */}
        <div className="w-48 flex-none border-l border-line">
          <div className="h-9 border-b border-line bg-line-soft/60" />
          {rows.map(({ task }) => (
            <button
              key={task.id}
              onClick={() => pane.open(task.id)}
              className="flex h-9 w-full items-center gap-1.5 truncate border-b border-line-soft px-2.5 text-right text-xs font-semibold hover:bg-line-soft/50"
              title={task.title}
            >
              {task.project && (
                <span
                  className="h-2 w-2 flex-none rounded-chip"
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
                  {d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" })}
                </div>
              ))}
            </div>
            {todayX > 0 && todayX < width && (
              <div
                className="absolute bottom-0 top-9 z-10 w-px bg-danger"
                style={{ left: todayX }}
                title="اليوم"
              />
            )}
            {rows.map(({ task, start, due }) => {
              const left = x(start);
              const w = Math.max(x(due) - left, DAY_W * 0.8);
              const overdue = due < new Date() && !task.isCompleted;
              return (
                <div key={task.id} className="relative h-9 border-b border-line-soft">
                  <button
                    onClick={() => pane.open(task.id)}
                    className="absolute top-1.5 h-6 rounded-md px-2 text-[10px] font-bold text-paper shadow-sm transition hover:opacity-80"
                    style={{
                      left,
                      width: w,
                      background: task.isCompleted
                        ? "#77705F"
                        : task.project?.color ?? "var(--masar-ink-2)",
                      outline: overdue ? "2px solid #B0413E" : undefined,
                      opacity: task.isCompleted ? 0.55 : 1,
                    }}
                    title={task.title}
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
