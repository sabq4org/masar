import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  X, Send, CheckSquare, Square, Plus, Link2, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { Me, StatusRow, TaskDetail, TaskRow, UserLite } from "../lib/types";
import { Avatar, PriorityChip, StatusChip } from "./bits";

const APPROVAL_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "بانتظار البتّ", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "معتمَد", cls: "bg-emerald-100 text-emerald-800" },
  changes_requested: { label: "طُلبت تعديلات", cls: "bg-violet-100 text-violet-800" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
};

export default function TaskSheet({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const key = `/api/tasks/${taskId}`;
  const { data: task } = useQuery<TaskDetail | null>({ queryKey: [key] });
  const { data: me } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const { data: statusesData } = useQuery<StatusRow[] | null>({ queryKey: ["/api/statuses"] });
  const users = Array.isArray(usersData) ? usersData : [];
  const statuses = Array.isArray(statusesData) ? statusesData : [];

  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addingDep, setAddingDep] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [approverId, setApproverId] = useState<number | "">("");
  const [decisionNote, setDecisionNote] = useState("");

  const { data: allTasksData } = useQuery<TaskRow[] | null>({
    queryKey: ["/api/tasks?roots=1&limit=300"],
    enabled: addingDep,
  });
  const candidateBlockers = (Array.isArray(allTasksData) ? allTasksData : []).filter(
    (t) => t.id !== taskId,
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks") });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/approvals") });
  }
  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 5000);
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
    onSuccess: () => { setComment(""); invalidate(); },
  });
  const addSubtask = useMutation({
    mutationFn: () => api("POST", `/api/tasks/${taskId}/subtasks`, { title: subtaskTitle }),
    onSuccess: () => { setSubtaskTitle(""); invalidate(); },
  });
  const toggleSubtask = useMutation({
    mutationFn: ({ id, isDone }: { id: number; isDone: boolean }) =>
      api("PATCH", `/api/subtasks/${id}`, { isDone }),
    onSuccess: invalidate,
  });
  const addDependency = useMutation({
    mutationFn: (blockedByTaskId: number) =>
      api("POST", `/api/tasks/${taskId}/dependencies`, { blockedByTaskId }),
    onSuccess: () => { setAddingDep(false); invalidate(); },
    onError: (e: Error) => showError(e.message),
  });
  const removeDependency = useMutation({
    mutationFn: (depId: number) => api("DELETE", `/api/tasks/${taskId}/dependencies/${depId}`),
    onSuccess: invalidate,
  });
  const requestApproval = useMutation({
    mutationFn: () => api("POST", `/api/tasks/${taskId}/approvals`, { approverId }),
    onSuccess: () => { setRequestingApproval(false); setApproverId(""); invalidate(); },
    onError: (e: Error) => showError(e.message),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: string }) =>
      api("POST", `/api/approvals/${id}/decide`, { decision, note: decisionNote || undefined }),
    onSuccess: () => { setDecisionNote(""); invalidate(); },
    onError: (e: Error) => showError(e.message),
  });
  const aiSplit = useMutation({
    mutationFn: () => api("POST", "/api/ai/split-task", { taskId }),
    onSuccess: invalidate,
    onError: (e: Error) => showError(e.message),
  });

  if (!task) return null;
  const statusOf = (id: number) => statuses.find((s) => s.id === id);
  const pendingApproval = task.approvals?.find((a) => a.state === "pending");
  const iAmApprover = pendingApproval && me && pendingApproval.approverId === me.id;
  const nameOf = (id: number) => users.find((u) => u.id === id)?.name ?? `#${id}`;
  const openBlockers = (task.dependencies ?? []).filter((d) => {
    const s = statusOf(d.statusId);
    return s && s.category !== "done" && s.category !== "closed";
  });

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
              {openBlockers.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                  ⏸ محجوبة بـ{openBlockers.length}
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={20} /></button>
        </header>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* شريط قرار الاعتماد — يظهر للمعتمد المعني فقط */}
        {iAmApprover && (
          <div className="border-b border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
              <ShieldCheck size={16} /> طلب اعتماد من {nameOf(pendingApproval!.requestedById)}
              {pendingApproval!.note && <span className="font-normal">— {pendingApproval!.note}</span>}
            </div>
            <input
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="ملاحظة القرار (اختيارية)…"
              className="mb-2 w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => decide.mutate({ id: pendingApproval!.id, decision: "approved" })}
                className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                اعتماد
              </button>
              <button
                onClick={() => decide.mutate({ id: pendingApproval!.id, decision: "changes_requested" })}
                className="flex-1 rounded-lg bg-violet-600 py-1.5 text-sm font-bold text-white hover:bg-violet-700"
              >
                طلب تعديل
              </button>
              <button
                onClick={() => decide.mutate({ id: pendingApproval!.id, decision: "rejected" })}
                className="flex-1 rounded-lg bg-red-600 py-1.5 text-sm font-bold text-white hover:bg-red-700"
              >
                رفض
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
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

          {/* الاعتماديات */}
          <Field label="العوائق (محجوبة بـ)">
            <div className="space-y-1.5">
              {(task.dependencies ?? []).map((d) => {
                const s = statusOf(d.statusId);
                const done = s && (s.category === "done" || s.category === "closed");
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 rounded-lg border border-line-soft px-2.5 py-1.5 text-sm"
                  >
                    <Link2 size={14} className={done ? "text-emerald-600" : "text-amber-600"} />
                    <span className={clsx("flex-1 truncate", done && "text-ink-3 line-through")}>
                      {d.title}
                    </span>
                    {s && <StatusChip status={s} />}
                    <button
                      onClick={() => removeDependency.mutate(d.id)}
                      className="text-ink-3 hover:text-red-600"
                      title="إزالة العائق"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              {addingDep ? (
                <select
                  autoFocus
                  onChange={(e) => e.target.value && addDependency.mutate(Number(e.target.value))}
                  onBlur={() => setAddingDep(false)}
                  className="w-full rounded-lg border border-accent px-2 py-1.5 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>اختر المهمة الحاجبة…</option>
                  {candidateBlockers.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => setAddingDep(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  <Plus size={13} /> إضافة عائق
                </button>
              )}
            </div>
          </Field>

          {/* الاعتماد */}
          <Field label="الاعتماد">
            <div className="space-y-1.5">
              {(task.approvals ?? []).slice(0, 3).map((a) => {
                const st = APPROVAL_LABELS[a.state] ?? APPROVAL_LABELS.pending;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", st.cls)}>
                      {st.label}
                    </span>
                    <span className="text-xs text-ink-2">
                      المعتمد: {nameOf(a.approverId)}
                      {a.decisionNote && ` — ${a.decisionNote}`}
                    </span>
                  </div>
                );
              })}
              {!pendingApproval &&
                (requestingApproval ? (
                  <div className="flex gap-2">
                    <select
                      value={approverId}
                      onChange={(e) => setApproverId(e.target.value ? Number(e.target.value) : "")}
                      className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm"
                    >
                      <option value="">اختر المعتمد…</option>
                      {users.filter((u) => u.id !== me?.id).map((u) => (
                        <option key={u.id} value={u.id}>{u.name} — {u.roleLabel}</option>
                      ))}
                    </select>
                    <button
                      disabled={!approverId || requestApproval.isPending}
                      onClick={() => requestApproval.mutate()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      إرسال
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRequestingApproval(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                  >
                    <ShieldCheck size={13} /> طلب اعتماد
                  </button>
                ))}
            </div>
          </Field>

          {/* المهام الفرعية */}
          <Field
            label={`المهام الفرعية (${task.subtasks.filter((s) => s.isDone).length}/${task.subtasks.length})`}
            action={
              <button
                onClick={() => aiSplit.mutate()}
                disabled={aiSplit.isPending}
                title="تقسيم المهمة بالذكاء الاصطناعي"
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline disabled:opacity-50"
              >
                <Sparkles size={13} /> {aiSplit.isPending ? "يقسّم…" : "تقسيم ذكي"}
              </button>
            }
          >
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

          <details className="rounded-lg border border-line-soft p-2">
            <summary className="cursor-pointer text-xs font-bold text-ink-3">
              سجل النشاط ({task.activity.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-2">
              {task.activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>{a.user?.name ?? "النظام"} · {activityLabel(a.action, a.detail)}</span>
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

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-ink-2">{label}</span>
        {action}
      </div>
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
    case "dependency_added": return "أضاف عائقًا";
    case "approval_requested": return "طلب اعتمادًا";
    case "approval_decided": return `بتّ في الاعتماد (${detail?.decision ?? ""})`;
    case "ai_split": return `قسّم المهمة ذكيًا (${detail?.count ?? 0} فرعيات)`;
    default: return action;
  }
}
