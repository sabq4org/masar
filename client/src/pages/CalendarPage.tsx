import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import type { TaskRow } from "../lib/types";
import TaskSheet from "../components/TaskSheet";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery<TaskRow[] | null>({ queryKey: ["/api/tasks?roots=1&limit=500"] });
  const tasks = Array.isArray(data) ? data : [];

  const weeks = useMemo(() => {
    const first = new Date(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // بداية الأسبوع: الأحد
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    const out: Date[][] = [];
    for (let i = 0; i < 6; i++) out.push(cells.slice(i * 7, i * 7 + 7));
    // احذف الأسابيع الخارجة كليًا عن الشهر
    return out.filter((week) => week.some((d) => d.getMonth() === cursor.getMonth()));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const key = new Date(t.dueAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  const monthLabel = cursor.toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
  const today = new Date().toDateString();

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4 sm:gap-3">
        <h1 className="flex-1 text-xl font-extrabold sm:text-2xl">التقويم</h1>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-field border border-line p-1.5 hover:bg-line-soft"
          title="الشهر السابق"
        >
          <ChevronRight size={16} />
        </button>
        <span className="min-w-32 text-center font-bold">{monthLabel}</span>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-field border border-line p-1.5 hover:bg-line-soft"
          title="الشهر التالي"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => {
            const d = new Date();
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
          className="rounded-field border border-line px-3 py-1.5 text-sm font-semibold hover:bg-line-soft"
        >
          اليوم
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <div className="min-w-[640px] sm:min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-line bg-line-soft/60">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-1 py-2 text-center text-[10px] font-bold text-ink-2 sm:px-2 sm:text-xs">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line-soft last:border-b-0">
              {week.map((day) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = day.toDateString() === today;
                const dayTasks = byDay.get(day.toDateString()) ?? [];
                return (
                  <div
                    key={day.toISOString()}
                    className={clsx(
                      "min-h-16 border-l border-line-soft p-1 last:border-l-0 sm:min-h-24 sm:p-1.5",
                      !inMonth && "bg-line-soft/40",
                    )}
                  >
                    <div
                      className={clsx(
                        "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-chip text-xs tabular-nums",
                        isToday ? "bg-accent font-bold text-paper" : "text-ink-3",
                      )}
                    >
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((t) => {
                        const done =
                          t.status?.category === "done" || t.status?.category === "closed";
                        return (
                          <button
                            key={t.id}
                            onClick={() => setOpenId(t.id)}
                            title={t.title}
                            className={clsx(
                              "block w-full truncate rounded px-1.5 py-0.5 text-right text-[11px] font-semibold text-paper",
                              done && "opacity-45 line-through",
                            )}
                            style={{
                              background: t.project?.color ?? t.status?.color ?? "#475569",
                            }}
                          >
                            {t.title}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <div className="px-1 text-[10px] text-ink-3">+{dayTasks.length - 3} أخرى</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {openId && <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
