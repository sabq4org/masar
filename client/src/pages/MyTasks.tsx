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
      <h1 className="mb-4 text-2xl font-extrabold">مهامي</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (quickTitle.trim()) quickAdd.mutate(quickTitle.trim());
        }}
        className="mb-6 flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2"
      >
        <Plus size={18} className="text-accent" />
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="إضافة مهمة سريعة… (Enter للحفظ)"
          className="flex-1 bg-transparent py-1 focus:outline-none"
        />
      </form>

      {GROUPS.map(({ key, label }) => {
        const list = grouped[key] ?? [];
        if (!list.length && key !== "today") return null;
        return (
          <section key={key} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-2">
              {label}
              <span className="rounded-chip bg-line-soft px-2 text-xs tabular-nums">{list.length}</span>
            </h2>
            <div className="divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
              {list.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-ink-3">لا مهام هنا — السطر أمامك نظيف</div>
              )}
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-line-soft/50"
                >
                  {t.project && (
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-chip"
                      title={t.project.name}
                      style={{ background: t.project.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />
                  <DueBadge task={t} />
                  {t.assignee && <Avatar name={t.assignee.name} color={t.assignee.avatarColor} />}
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
