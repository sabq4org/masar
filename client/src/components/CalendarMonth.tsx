import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TaskRow } from "../lib/types";
import { isSameDay, startOfDay } from "../lib/dates";
import { useTaskPane } from "../lib/taskPane";

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MS_DAY = 86400_000;

/** تقويم شهري بأسلوب أسانا — المهام على تواريخ استحقاقها */
export default function CalendarMonth({ tasks }: { tasks: TaskRow[] }) {
  const pane = useTaskPane();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return startOfDay(d);
  });

  const weeks = useMemo(() => {
    const first = new Date(anchor);
    const gridStart = new Date(first.getTime() - first.getDay() * MS_DAY);
    const out: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) row.push(new Date(gridStart.getTime() + (w * 7 + d) * MS_DAY));
      out.push(row);
    }
    // احذف الأسبوع السادس إن كان كله خارج الشهر
    const last = out[5];
    if (last.every((d) => d.getMonth() !== anchor.getMonth())) out.pop();
    return out;
  }, [anchor]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const k = startOfDay(new Date(t.dueAt)).toISOString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks]);

  const today = new Date();
  const monthLabel = anchor.toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" });

  function shift(months: number) {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + months);
    setAnchor(d);
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button onClick={() => shift(1)} className="rounded p-1 text-ink-3 hover:text-ink" title="الشهر التالي">
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => shift(-1)} className="rounded p-1 text-ink-3 hover:text-ink" title="الشهر السابق">
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-bold">{monthLabel}</span>
        <div className="flex-1" />
        <button
          onClick={() => {
            const d = new Date();
            d.setDate(1);
            setAnchor(startOfDay(d));
          }}
          className="rounded-field border border-line px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft"
        >
          اليوم
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-line-soft bg-paper/70 text-center text-[11px] font-bold text-ink-3">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5">{d}</div>
        ))}
      </div>
      {weeks.map((row, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-line-soft last:border-b-0">
          {row.map((day) => {
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = isSameDay(day, today);
            const list = tasksByDay.get(day.toISOString()) ?? [];
            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  "min-h-24 border-l border-line-soft p-1 last:border-l-0",
                  !inMonth && "bg-paper/50 opacity-60",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={clsx(
                      "flex h-5 w-5 items-center justify-center rounded-chip text-[11px] font-bold tabular-nums",
                      isToday ? "bg-saffron text-paper" : "text-ink-3",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => pane.open(t.id)}
                      className={clsx(
                        "block w-full truncate rounded-md px-1.5 py-0.5 text-right text-[10px] font-bold text-paper hover:opacity-85",
                        t.isCompleted && "opacity-50",
                      )}
                      style={{ background: t.project?.color ?? "var(--masar-ink-2)" }}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  ))}
                  {list.length > 3 && (
                    <div className="px-1 text-[10px] font-semibold text-ink-3">+{list.length - 3} المزيد</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
