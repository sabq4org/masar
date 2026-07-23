import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Check,
  ChevronsLeft,
  CircleAlert,
  Copy,
  Diamond,
  Link2,
  Lock,
  MoreHorizontal,
  Paperclip,
  Plus,
  ThumbsUp,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { Me, ProjectRow, TaskDetail, UserLite } from "../lib/types";
import { relTime } from "../lib/dates";
import { Avatar, CheckCircle, ErrorBar } from "./bits";
import { AssigneePicker, DueDatePicker, Popover, PriorityPicker } from "./pickers";
import { useTaskPane } from "../lib/taskPane";

const ACTIVITY_LABELS: Record<string, string> = {
  created: "أنشأ المهمة",
  assigned: "غيّر المسؤول",
  updated: "عدّل المهمة",
  completed: "أكمل المهمة",
  uncompleted: "أعاد فتح المهمة",
  due_changed: "غيّر تاريخ الاستحقاق",
  subtask_added: "أضاف مهمة فرعية",
  dependency_added: "أضاف اعتمادية",
  attachment_added: "أرفق ملفًا",
  liked: "أُعجب بالمهمة",
  approval_decided: "بتّ في الاعتماد",
  ai_split: "قسّم المهمة بالذكاء الاصطناعي",
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;
}

export default function TaskPane() {
  const { taskId, open, close } = useTaskPane();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const key = `/api/tasks/${taskId}`;
  const { data: task } = useQuery<TaskDetail | null>({ queryKey: [key], enabled: !!taskId });
  const { data: meData } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const { data: projectsData } = useQuery<ProjectRow[] | null>({ queryKey: ["/api/projects"] });
  const { data: projectDetail } = useQuery<ProjectRow | null>({
    queryKey: [`/api/projects/${task?.projectId}`],
    enabled: !!task?.projectId,
  });
  const users = Array.isArray(usersData) ? usersData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];

  useEffect(() => {
    setComment("");
    setSubtaskTitle("");
    setAddingSubtask(false);
    setMenuOpen(false);
  }, [taskId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && taskId) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, close]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks?"),
    });
  };

  const patch = useMutation({
    mutationFn: (fields: Record<string, unknown>) => api("PATCH", key, fields),
    onSuccess: invalidate,
    onError: (e: Error) => flash(e.message),
  });

  const act = useMutation({
    mutationFn: ({ method, url, body }: { method: "POST" | "DELETE"; url: string; body?: unknown }) =>
      api(method, url, body),
    onSuccess: invalidate,
    onError: (e: Error) => flash(e.message),
  });

  function flash(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  if (!taskId) return null;
  if (!task)
    return (
      <aside className="masar-sheet fixed inset-y-0 left-0 z-40 w-full max-w-2xl border-r border-line bg-surface p-6 text-sm text-ink-3 shadow-xl">
        جارٍ التحميل…
      </aside>
    );

  const me = meData ?? null;
  const isCollaborator = me ? task.watchers.some((w) => w.userId === me.id) : false;
  const openDeps = task.dependencies.filter((d) => d.task && !d.task.isCompleted);
  const doneSubtasks = task.subtasks.filter((s) => s.isCompleted).length;

  const feed: Array<
    | { kind: "activity"; id: string; at: string; node: React.ReactNode }
    | { kind: "comment"; id: string; at: string; c: TaskDetail["comments"][number] }
  > = [
    ...task.activity
      .filter((a) => ACTIVITY_LABELS[a.action])
      .map((a) => ({
        kind: "activity" as const,
        id: `a${a.id}`,
        at: a.createdAt,
        node: (
          <span>
            <b>{a.user?.name ?? "النظام"}</b> {ACTIVITY_LABELS[a.action]}
            <span className="mx-1.5 text-ink-3">·</span>
            <span className="text-ink-3">{relTime(a.createdAt)}</span>
          </span>
        ),
      })),
    ...task.comments.map((c) => ({ kind: "comment" as const, id: `c${c.id}`, at: c.createdAt, c })),
  ].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());

  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink/10 lg:hidden" onClick={close} />
      <aside className="masar-sheet fixed inset-y-0 left-0 z-40 flex w-full max-w-2xl flex-col border-r border-line bg-surface shadow-xl">
        {/* ─── شريط الأدوات العلوي ─── */}
        <div className="flex flex-none items-center gap-1.5 border-b border-line px-3 py-2.5">
          <button
            onClick={() => patch.mutate({ isCompleted: !task.isCompleted })}
            className={clsx(
              "flex items-center gap-1.5 rounded-field border px-2.5 py-1 text-xs font-bold transition",
              task.isCompleted
                ? "border-success bg-success text-paper"
                : "border-line text-ink-2 hover:border-success hover:text-success",
            )}
          >
            <Check size={14} strokeWidth={3} />
            {task.isCompleted ? "مكتملة" : "وضع علامة الإكمال"}
          </button>

          <div className="flex-1" />

          <button
            onClick={() =>
              act.mutate({ method: task.likedByMe ? "DELETE" : "POST", url: `${key}/like` })
            }
            className={clsx(
              "flex items-center gap-1 rounded-field px-2 py-1 text-xs font-semibold",
              task.likedByMe ? "text-saffron" : "text-ink-3 hover:text-saffron",
            )}
            title="إعجاب"
          >
            <ThumbsUp size={15} />
            {task.likes.length > 0 && <span className="tabular-nums">{task.likes.length}</span>}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-field p-1.5 text-ink-3 hover:text-saffron"
            title="إرفاق ملف"
          >
            <Paperclip size={15} />
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/task/${task.id}`).then(
                () => flash("نُسخ رابط المهمة"),
                () => flash("تعذر النسخ"),
              );
            }}
            className="rounded-field p-1.5 text-ink-3 hover:text-saffron"
            title="نسخ الرابط"
          >
            <Link2 size={15} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-field p-1.5 text-ink-3 hover:text-ink"
              title="المزيد"
            >
              <MoreHorizontal size={16} />
            </button>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} align="end" className="w-52">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  act.mutate({ method: "POST", url: `${key}/duplicate` });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
              >
                <Copy size={13} /> نسخ المهمة
              </button>
              <div className="my-1 border-t border-line-soft" />
              <div className="px-2 py-1 text-[10px] font-bold text-ink-3">نوع المهمة</div>
              {(
                [
                  ["task", "مهمة عادية"],
                  ["milestone", "معلم رئيسي"],
                  ["approval", "اعتماد"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => {
                    setMenuOpen(false);
                    patch.mutate({ taskType: t });
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft",
                    task.taskType === t && "text-saffron",
                  )}
                >
                  {t === "milestone" ? <Diamond size={12} /> : <Check size={12} />} {label}
                </button>
              ))}
              <div className="my-1 border-t border-line-soft" />
              <button
                onClick={() => {
                  if (!confirm("حذف المهمة نهائيًا؟")) return;
                  setMenuOpen(false);
                  act.mutate({ method: "DELETE", url: key });
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <Trash2 size={13} /> حذف المهمة
              </button>
            </Popover>
          </div>
          <button onClick={close} className="rounded-field p-1.5 text-ink-3 hover:text-ink" title="إغلاق (Esc)">
            <ChevronsLeft size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ─── تنبيهات ─── */}
          {task.parent && (
            <button
              onClick={() => open(task.parent!.id)}
              className="mx-4 mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-saffron"
            >
              <span className="text-ink-3">مهمة فرعية من:</span>
              <span className="underline decoration-dotted">{task.parent.title}</span>
            </button>
          )}
          {openDeps.length > 0 && !task.isCompleted && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-field border border-wait/40 bg-wait/10 px-3 py-2 text-xs font-semibold text-wait">
              <Lock size={14} className="mt-0.5 flex-none" />
              <div>
                هذه المهمة محجوبة بـ:
                {openDeps.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => d.task && open(d.task.id)}
                    className="mr-1.5 underline decoration-dotted hover:text-ink"
                  >
                    «{d.task?.title}»
                  </button>
                ))}
              </div>
            </div>
          )}
          {task.taskType === "approval" && (
            <div className="mx-4 mt-3 rounded-field border border-review/30 bg-review/5 px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-review">
                <CircleAlert size={14} />
                مهمة اعتماد
                {task.approvalStatus === "approved" && " — معتمدة ✓"}
                {task.approvalStatus === "changes_requested" && " — طُلبت تعديلات"}
                {task.approvalStatus === "rejected" && " — مرفوضة"}
              </div>
              {task.approvalStatus === "pending" && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "approved" } })}
                    className="rounded-field bg-success px-3 py-1 text-xs font-bold text-paper hover:opacity-90"
                  >
                    اعتماد
                  </button>
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "changes_requested" } })}
                    className="rounded-field border border-wait px-3 py-1 text-xs font-bold text-wait hover:bg-wait/10"
                  >
                    طلب تعديل
                  </button>
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "rejected" } })}
                    className="rounded-field border border-danger px-3 py-1 text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    رفض
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── العنوان ─── */}
          <div className="px-4 pt-3">
            <textarea
              ref={titleRef}
              key={task.id + task.title}
              defaultValue={task.title}
              rows={1}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) patch.mutate({ title: v });
              }}
              className={clsx(
                "w-full resize-none overflow-hidden rounded-field border border-transparent bg-transparent px-2 py-1 font-display text-xl font-bold leading-snug hover:border-line focus:border-saffron focus:outline-none",
                task.isCompleted && "text-ink-3",
              )}
            />
          </div>

          {/* ─── الحقول ─── */}
          <div className="mt-2 space-y-1 px-6">
            <FieldRow label="المسؤول">
              <AssigneePicker
                value={task.assignee ?? null}
                onChange={(userId) => patch.mutate({ assigneeId: userId })}
              />
            </FieldRow>
            <FieldRow label="تاريخ الاستحقاق">
              <DueDatePicker
                value={task.dueAt}
                isCompleted={task.isCompleted}
                onChange={(iso) => patch.mutate({ dueAt: iso })}
              />
            </FieldRow>
            <FieldRow label="المشروع">
              <div className="flex items-center gap-1.5">
                <select
                  value={task.projectId ?? ""}
                  onChange={(e) =>
                    patch.mutate({
                      projectId: e.target.value ? Number(e.target.value) : null,
                      sectionId: null,
                    })
                  }
                  className="max-w-44 rounded-field border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold hover:border-line focus:outline-none"
                >
                  <option value="">بلا مشروع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {task.projectId && (
                  <select
                    value={task.sectionId ?? ""}
                    onChange={(e) =>
                      patch.mutate({ sectionId: e.target.value ? Number(e.target.value) : null })
                    }
                    className="max-w-36 rounded-field border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink-2 hover:border-line focus:outline-none"
                  >
                    <option value="">بلا قسم</option>
                    {(projectDetail?.sections ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </FieldRow>
            <FieldRow label="الأولوية">
              <PriorityPicker value={task.priority} onChange={(p) => patch.mutate({ priority: p })} />
            </FieldRow>
            {task.linkUrl && (
              <FieldRow label="رابط مرجعي">
                <a
                  href={task.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-64 truncate text-xs font-semibold text-review underline decoration-dotted"
                  dir="ltr"
                >
                  {task.linkUrl}
                </a>
              </FieldRow>
            )}
          </div>

          {/* ─── الوصف ─── */}
          <div className="mt-3 px-6">
            <div className="mb-1 text-xs font-bold text-ink-2">الوصف</div>
            <textarea
              key={task.id + (task.description ?? "")}
              defaultValue={task.description ?? ""}
              placeholder="عمّ تدور هذه المهمة؟"
              rows={3}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (task.description ?? "")) patch.mutate({ description: v || null });
              }}
              className="w-full resize-y rounded-field border border-line-soft bg-transparent px-3 py-2 text-sm leading-relaxed hover:border-line focus:border-saffron focus:outline-none"
            />
          </div>

          {/* ─── المهام الفرعية ─── */}
          <div className="mt-3 px-6">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-bold text-ink-2">
                المهام الفرعية
                {task.subtasks.length > 0 && (
                  <span className="mr-1.5 text-[10px] font-semibold text-ink-3 tabular-nums">
                    {doneSubtasks}/{task.subtasks.length}
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-line-soft rounded-field border border-line-soft">
              {task.subtasks.map((s) => (
                <div
                  key={s.id}
                  onClick={() => open(s.id)}
                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-line-soft/40"
                >
                  <SubtaskToggle id={s.id} checked={s.isCompleted} invalidate={invalidate} onError={flash} />
                  <span className={clsx("min-w-0 flex-1 truncate text-sm", s.isCompleted && "text-ink-3")}>
                    {s.title}
                  </span>
                  {s.assignee && <Avatar name={s.assignee.name} color={s.assignee.avatarColor} size={5} />}
                </div>
              ))}
              {addingSubtask ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = subtaskTitle.trim();
                    if (!v) return setAddingSubtask(false);
                    act.mutate({ method: "POST", url: `${key}/subtasks`, body: { title: v } });
                    setSubtaskTitle("");
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5"
                >
                  <span className="h-4 w-4 flex-none rounded-chip border border-dashed border-ink-3/50" />
                  <input
                    autoFocus
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onBlur={() => {
                      if (subtaskTitle.trim())
                        act.mutate({ method: "POST", url: `${key}/subtasks`, body: { title: subtaskTitle.trim() } });
                      setSubtaskTitle("");
                      setAddingSubtask(false);
                    }}
                    placeholder="اسم المهمة الفرعية…"
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-ink-3 hover:text-saffron"
                >
                  <Plus size={13} /> إضافة مهمة فرعية
                </button>
              )}
            </div>
          </div>

          {/* ─── الاعتماديات ─── */}
          <div className="mt-3 px-6">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-bold text-ink-2">محجوبة بـ</div>
              <div className="relative">
                <button
                  onClick={() => setDepOpen(!depOpen)}
                  className="flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-saffron"
                >
                  <Plus size={12} /> إضافة
                </button>
                <DependencyPicker
                  open={depOpen}
                  onClose={() => setDepOpen(false)}
                  task={task}
                  onPick={(id) =>
                    act.mutate({ method: "POST", url: `${key}/dependencies`, body: { blockedByTaskId: id } })
                  }
                />
              </div>
            </div>
            {task.dependencies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {task.dependencies.map((d) => (
                  <span
                    key={d.id}
                    className={clsx(
                      "group flex items-center gap-1 rounded-chip border px-2 py-0.5 text-xs font-semibold",
                      d.task?.isCompleted
                        ? "border-line text-ink-3 line-through"
                        : "border-wait/40 bg-wait/10 text-wait",
                    )}
                  >
                    <button onClick={() => d.task && open(d.task.id)} className="hover:underline">
                      {d.task?.title ?? "مهمة محذوفة"}
                    </button>
                    <button
                      onClick={() => act.mutate({ method: "DELETE", url: `${key}/dependencies/${d.id}` })}
                      className="hidden text-ink-3 hover:text-danger group-hover:inline"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-3">لا اعتماديات — المهمة طليقة</div>
            )}
          </div>

          {/* ─── المرفقات ─── */}
          {task.attachments.length > 0 && (
            <div className="mt-3 px-6">
              <div className="mb-1 text-xs font-bold text-ink-2">المرفقات</div>
              <div className="grid grid-cols-2 gap-1.5">
                {task.attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-2 rounded-field border border-line-soft px-2.5 py-1.5 hover:border-line"
                  >
                    <Paperclip size={13} className="flex-none text-ink-3" />
                    <a
                      href={`/uploads/${a.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-xs font-semibold hover:text-saffron"
                      title={a.originalName}
                    >
                      {a.originalName}
                    </a>
                    <span className="flex-none text-[10px] text-ink-3 tabular-nums">{fmtSize(a.size)}</span>
                    <button
                      onClick={() => act.mutate({ method: "DELETE", url: `/api/attachments/${a.id}` })}
                      className="hidden flex-none text-ink-3 hover:text-danger group-hover:block"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── المتعاونون ─── */}
          <div className="mt-4 border-t border-line-soft bg-paper/60 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-2">المتعاونون</span>
              <div className="flex -space-x-1 space-x-reverse">
                {task.watchers.map((w) => (
                  <Avatar key={w.userId} name={w.user.name} color={w.user.avatarColor} size={6} />
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setCollabOpen(!collabOpen)}
                  className="flex h-6 w-6 items-center justify-center rounded-chip border border-dashed border-ink-3/50 text-ink-3 hover:border-saffron hover:text-saffron"
                  title="إضافة متعاون"
                >
                  <UserPlus size={12} />
                </button>
                <Popover open={collabOpen} onClose={() => setCollabOpen(false)} className="max-h-64 w-56 overflow-y-auto">
                  {users
                    .filter((u) => !task.watchers.some((w) => w.userId === u.id))
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          act.mutate({ method: "POST", url: `${key}/watchers`, body: { userId: u.id } });
                          setCollabOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
                      >
                        <Avatar name={u.name} color={u.avatarColor} size={6} />
                        {u.name}
                      </button>
                    ))}
                </Popover>
              </div>
              <div className="flex-1" />
              {me && (
                <button
                  onClick={() =>
                    isCollaborator
                      ? act.mutate({ method: "DELETE", url: `${key}/watchers/${me.id}` })
                      : act.mutate({ method: "POST", url: `${key}/watchers`, body: { userId: me.id } })
                  }
                  className="text-xs font-semibold text-ink-3 hover:text-saffron"
                >
                  {isCollaborator ? "مغادرة المهمة" : "الانضمام للمهمة"}
                </button>
              )}
            </div>
          </div>

          {/* ─── النشاط والتعليقات ─── */}
          <div className="space-y-2.5 px-6 py-3">
            {feed.map((item) =>
              item.kind === "activity" ? (
                <div key={item.id} className="text-[11px] text-ink-2">{item.node}</div>
              ) : (
                <CommentBubble key={item.id} c={item.c} meId={me?.id ?? 0} act={act} />
              ),
            )}
            {feed.length === 0 && <div className="text-xs text-ink-3">لا نشاط بعد</div>}
          </div>
        </div>

        {/* ─── محرر التعليق ─── */}
        <div className="flex-none border-t border-line bg-surface px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = comment.trim();
              if (!v) return;
              act.mutate({ method: "POST", url: `${key}/comments`, body: { content: v } });
              setComment("");
            }}
            className="flex items-start gap-2"
          >
            {me && <Avatar name={me.name} color={me.avatarColor} size={7} />}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
                }
              }}
              placeholder="أضف تعليقًا… (Ctrl+Enter للإرسال)"
              rows={comment.includes("\n") ? 3 : 1}
              className="min-w-0 flex-1 resize-none rounded-field border border-line bg-paper px-3 py-1.5 text-sm focus:border-saffron focus:outline-none"
            />
            <button
              type="submit"
              disabled={!comment.trim()}
              className="rounded-field bg-accent px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
            >
              تعليق
            </button>
          </form>
        </div>

        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(`${key}/attachments`, { method: "POST", body: fd, credentials: "include" });
            if (!res.ok) flash((await res.json().catch(() => ({})))?.error ?? "فشل الرفع");
            invalidate();
          }}
        />
        <ErrorBar message={error} />
      </aside>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <div className="w-28 flex-none text-xs font-semibold text-ink-3">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** زر إكمال مهمة فرعية — لا يفتح اللوحة عند النقر */
function SubtaskToggle({
  id,
  checked,
  invalidate,
  onError,
}: {
  id: number;
  checked: boolean;
  invalidate: () => void;
  onError: (m: string) => void;
}) {
  return (
    <CheckCircle
      checked={checked}
      size={16}
      onToggle={(next) =>
        api("PATCH", `/api/tasks/${id}`, { isCompleted: next }).then(invalidate, (e) => onError(e.message))
      }
    />
  );
}

function CommentBubble({
  c,
  meId,
  act,
}: {
  c: { id: number; content: string; createdAt: string; user: { id: number; name: string; avatarColor: string }; likes: { userId: number }[] };
  meId: number;
  act: any;
}) {
  const liked = c.likes.some((l) => l.userId === meId);
  return (
    <div className="flex items-start gap-2">
      <Avatar name={c.user.name} color={c.user.avatarColor} size={7} />
      <div className="min-w-0 flex-1 rounded-field border border-line-soft bg-paper/70 px-3 py-2">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="text-xs font-bold">{c.user.name}</span>
          <span className="text-[10px] text-ink-3">{relTime(c.createdAt)}</span>
          <span className="flex-1" />
          <button
            onClick={() =>
              act.mutate({ method: liked ? "DELETE" : "POST", url: `/api/comments/${c.id}/like` })
            }
            className={clsx(
              "flex items-center gap-0.5 text-[11px] font-semibold",
              liked ? "text-saffron" : "text-ink-3 hover:text-saffron",
            )}
          >
            <ThumbsUp size={11} />
            {c.likes.length > 0 && <span className="tabular-nums">{c.likes.length}</span>}
          </button>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</div>
      </div>
    </div>
  );
}

function DependencyPicker({
  open,
  onClose,
  task,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskDetail;
  onPick: (taskId: number) => void;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery<TaskDetail[] | null>({
    queryKey: [
      task.projectId ? `/api/tasks?projectId=${task.projectId}&completed=0` : `/api/tasks?completed=0&limit=50`,
    ],
    enabled: open,
  });
  const candidates = (Array.isArray(data) ? data : []).filter(
    (t) =>
      t.id !== task.id &&
      !task.dependencies.some((d) => d.blockedByTaskId === t.id) &&
      (!q || t.title.includes(q)),
  );
  return (
    <Popover open={open} onClose={onClose} align="end" className="w-64">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث عن المهمة الحاجبة…"
        className="mb-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-xs focus:outline-none"
      />
      <div className="max-h-48 overflow-y-auto">
        {candidates.slice(0, 20).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onPick(t.id);
              onClose();
            }}
            className="block w-full truncate rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
          >
            {t.title}
          </button>
        ))}
        {!candidates.length && <div className="px-2 py-3 text-center text-xs text-ink-3">لا نتائج</div>}
      </div>
    </Popover>
  );
}
