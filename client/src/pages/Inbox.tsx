import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import TaskSheet from "../components/TaskSheet";

interface NotifRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  taskId: number | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  assigned: "تكليف",
  mention: "منشن",
  comment: "تعليق",
  status_change: "تغيير حالة",
  due_soon: "موعد قريب",
  overdue: "تأخر",
};

export default function Inbox() {
  const [openTask, setOpenTask] = useState<number | null>(null);
  const { data } = useQuery<{ items: NotifRow[]; unread: number } | null>({
    queryKey: ["/api/notifications"],
  });
  const items = data?.items ?? [];

  const markRead = useMutation({
    mutationFn: (id: number) => api("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => api("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">الإشعارات</h1>
        {items.some((n) => !n.isRead) && (
          <button
            onClick={() => readAll.mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <CheckCheck size={15} /> قراءة الكل
          </button>
        )}
      </div>
      <div className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-white">
        {items.length === 0 && (
          <div className="px-4 py-12 text-center text-ink-3">لا إشعارات — صندوقك صافٍ ✨</div>
        )}
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              if (!n.isRead) markRead.mutate(n.id);
              if (n.taskId) setOpenTask(n.taskId);
            }}
            className={clsx(
              "flex w-full items-start gap-3 px-4 py-3 text-right hover:bg-line-soft/50",
              !n.isRead && "bg-accent-soft/40",
            )}
          >
            {!n.isRead && <span className="mt-2 h-2 w-2 flex-none rounded-full bg-accent" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-line-soft px-1.5 text-[11px] font-bold text-ink-2">
                  {TYPE_LABELS[n.type] ?? n.type}
                </span>
                <span className="truncate text-sm font-bold">{n.title}</span>
              </div>
              {n.body && <div className="mt-0.5 truncate text-sm text-ink-2">{n.body}</div>}
            </div>
            <span className="flex-none text-xs text-ink-3 tabular-nums">
              {new Date(n.createdAt).toLocaleString("ar-SA", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </button>
        ))}
      </div>
      {openTask && <TaskSheet taskId={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}
