import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Send, CheckSquare, Square, Plus } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { TaskDetail, UserLite } from "../lib/types";
import { Avatar, PriorityChip, StatusChip } from "./bits";

export default function TaskSheet({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const key = `/api/tasks/${taskId}`;
  const { data: task } = useQuery<TaskDetail | null>({ queryKey: [key] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const users = Array.isArray(usersData) ? usersData : [];
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks?") });
  }

  const mutateTask = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api("PATCH", `/api/tasks/${taskId}`, patch),
    onSuccess: invalidate,
    onError: (e: Error) => showError(e.message),
  });
  const mutateStatus = useMutation({
    mutationFn: (statusId: number) => api("POST", `/api/tasks/${taskId}/status`, { statusId }),
    onSuccess: invalidate,
    onError: (e: Error) => showError(e.message),
  });
  const addComment = useMutation({
    mutationFn: () => api("POST", `/api/tasks/${taskId}/comments`, { content: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
  });
  const addSubtask = useMutation({
    mutationFn: () => api("POST", `/api/tasks/${taskId}/subtasks`, { title: subtaskTitle }),
    onSuccess: () => {
      setSubtaskTitle("");
      invalidate();
    },
  });
  const toggleSubtask = useMutation({
    mutationFn: ({ id, isDone }: { id: number; isDone: boolean }) =>
      api("PATCH", `/api/subtasks/${id}`, { isDone }),
    onSuccess: invalidate,
  });

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  if (!task) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-lg flex-col border-r border-line bg-white shadow-xl">
        <header className="flex items-start gap-3 border-b border-line p-4">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusChip status={task.status} />
              <PriorityChip priority={task.priority} />
              {task.project && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: task.project.color + "1f", color: task.project.color }}
                >
                  {task.project.name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink">
            <X size={20} />
          </button>
        </header>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* الحالة */}
          <Field label="نقل الحالة إلى">
            <div className="flex flex-wrap gap-1.5">
              {task.nextStatuses
                .filter((s) => s.id !== task.statusId)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => mutateStatus.mutate(s.id)}
                    className="rounded-full border px-2.5 py-0.5 text-xs font-bold transition hover:opacity-70"
                    style={{ borderColor: s.color, color: s.color }}
                  >
                    {s.nameAr}
                  </button>
                ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="المسؤول">
              <select
                value={task.assigneeId ?? ""}
                onChange={(e) =>
                  mutateTask.mutate({ assigneeId: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
              >
                <option value="">بلا مسؤول</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
            <Field label="الاستحقاق">
              <input
                type="date"
                value={task.dueAt ? task.dueAt.slice(0, 10) : ""}
                onChange={(e) =>
                  mutateTask.mutate({ dueAt: e.target.value ? new Date(e.target.value) : null })
                }
                className="w-full rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums"
              />
            </Field>
            <Field label="الأولوية">
              <select
                value={task.priority}
                onChange={(e) => mutateTask.mutate({ priority: e.target.value })}
                className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
              >
                <option value="low">منخفضة</option>
                <option value="normal">عادية</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </select>
            </Field>
            <Field label="رابط المادة">
              <input
                dir="ltr"
                defaultValue={task.linkUrl ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (task.linkUrl ?? "")) mutateTask.mutate({ linkUrl: v || null });
                }}
                placeholder="https://…"
                className="w-full rounded-lg border border-line px-2 py-1.5 text-left text-sm"
              />
            </Field>
          </div>

          <Field label="الوصف">
            <textarea
              defaultValue={task.description ?? ""}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (task.description ?? "")) mutateTask.mutate({ description: v || null });
              }}
              rows={3}
              placeholder="تفاصيل المهمة…"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </Field>

          {/* المهام الفرعية */}
          <Field label={`المهام الفرعية (${task.subtasks.filter((s) => s.isDone).length}/${task.subtasks.length})`}>
            <div className="space-y-1">
              {task.subtasks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSubtask.mutate({ id: s.id, isDone: !s.isDone })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-right text-sm hover:bg-line-soft"
                >
                  {s.isDone ? (
                    <CheckSquare size={16} className="text-emerald-600" />
                  ) : (
                    <Square size={16} className="text-ink-3" />
                  )}
                  <span className={s.isDone ? "text-ink-3 line-through" : ""}>{s.title}</span>
                </button>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (subtaskTitle.trim()) addSubtask.mutate();
                }}
                className="flex items-center gap-2 px-2"
              >
                <Plus size={14} className="text-ink-3" />
                <input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="مهمة فرعية جديدة…"
                  className="flex-1 bg-transparent py-1 text-sm focus:outline-none"
                />
              </form>
            </div>
          </Field>

          {/* التعليقات */}
          <Field label="التعليقات">
            <div className="space-y-3">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.user.name} color={c.user.avatarColor} size={6} />
                  <div className="flex-1 rounded-lg bg-line-soft px-3 py-2">
                    <div className="mb-0.5 flex items-baseline justify-between">
                      <span className="text-xs font-bold">{c.user.name}</span>
                      <span className="text-[11px] text-ink-3 tabular-nums">
                        {new Date(c.createdAt).toLocaleString("ar-SA", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          {/* السجل */}
          <details className="rounded-lg border border-line-soft p-2">
            <summary className="cursor-pointer text-xs font-bold text-ink-3">
              سجل النشاط ({task.activity.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-2">
              {task.activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>
                    {a.user?.name ?? "النظام"} · {activityLabel(a.action, a.detail)}
                  </span>
                  <span className="flex-none text-ink-3 tabular-nums">
                    {new Date(a.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <footer className="border-t border-line p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) addComment.mutate();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="اكتب تعليقًا…"
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              disabled={addComment.isPending || !comment.trim()}
              className="rounded-lg bg-accent p-2 text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold text-ink-2">{label}</div>
      {children}
    </div>
  );
}

function activityLabel(action: string, detail: any): string {
  switch (action) {
    case "created": return "أنشأ المهمة";
    case "assigned": return "غيّر المسؤول";
    case "status_changed": return `نقل الحالة: ${detail?.from ?? ""} ← ${detail?.to ?? ""}`;
    case "updated": return "عدّل الحقول";
    case "subtask_added": return `أضاف فرعية: ${detail?.title ?? ""}`;
    default: return action;
  }
}
