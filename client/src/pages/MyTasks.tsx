import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { TaskRow } from "../lib/types";
import { Avatar, DueBadge, PriorityChip, StatusChip } from "../components/bits";
import TaskSheet from "../components/TaskSheet";

const GROUPS = [
  { key: "overdue", label: "متأخرة" },
  { key: "today", label: "اليوم" },
  { key: "upcoming", label: "قادمة (٧ أيام)" },
  { key: "later", label: "لاحقًا / بلا موعد" },
] as const;

export default function MyTasks() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const { data } = useQuery<TaskRow[] | null>({ queryKey: ["/api/tasks?mine=1&roots=1"] });
  const tasks = Array.isArray(data) ? data : [];

  const quickAdd = useMutation({
    mutationFn: (title: string) => api("POST", "/api/tasks", { title }),
    onSuccess: () => {
      setQuickTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks?mine=1&roots=1"] });
    },
  });

  const grouped = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59);
    const weekEnd = new Date(now.getTime() + 7 * 86400_000);
    const open = tasks.filter(
      (t) => t.status?.category !== "done" && t.status?.category !== "closed",
    );
    return {
      overdue: open.filter((t) => t.dueAt && new Date(t.dueAt) < now && new Date(t.dueAt).toDateString() !== now.toDateString()),
      today: open.filter((t) => t.dueAt && new Date(t.dueAt).toDateString() === now.toDateString()),
      upcoming: open.filter((t) => {
        if (!t.dueAt) return false;
        const d = new Date(t.dueAt);
        return d > todayEnd && d <= weekEnd;
      }),
      later: open.filter((t) => !t.dueAt || new Date(t.dueAt) > weekEnd),
    } as Record<string, TaskRow[]>;
  }, [tasks]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold">مهامي</h1>
        <span className="text-[11px] font-semibold text-ink-3">
          N مهمة جديدة · Esc إغلاق
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (quickTitle.trim()) quickAdd.mutate(quickTitle.trim());
        }}
        className="mb-4 flex h-10 items-center gap-2 rounded-field border border-line bg-surface px-3"
      >
        <Plus size={16} className="text-accent" />
        <input
          id="masar-quick-add"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="إضافة مهمة سريعة… (Enter)"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </form>

      {GROUPS.map(({ key, label }) => {
        const list = grouped[key] ?? [];
        if (!list.length && key !== "today") return null;
        return (
          <section key={key} className="mb-4">
            <h2 className="mb-1.5 flex items-center gap-2 text-xs font-bold text-ink-2">
              {label}
              <span className="rounded-chip bg-line-soft px-1.5 text-[11px] tabular-nums">{list.length}</span>
            </h2>
            <div className="divide-y divide-line-soft overflow-hidden rounded-field border border-line bg-surface">
              {list.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-ink-3">لا مهام هنا — السطر أمامك نظيف</div>
              )}
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="flex h-10 w-full items-center gap-2.5 px-3 text-right text-sm hover:bg-line-soft/50"
                >
                  {t.project && (
                    <span
                      className="h-2 w-2 flex-none rounded-chip"
                      title={t.project.name}
                      style={{ background: t.project.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                  <DueBadge task={t} />
                  {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={6} />}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {openId && <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
