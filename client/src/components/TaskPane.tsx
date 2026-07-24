import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
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
import type { MsgKey } from "../locales/en";
import { useI18n } from "../lib/i18n";
import { Avatar, CheckCircle, ErrorBar } from "./bits";
import { AssigneePicker, DueDatePicker, Popover, PriorityPicker } from "./pickers";
import { useTaskPane } from "../lib/taskPane";

function fmtSize(bytes: number, t: ReturnType<typeof useI18n>["t"]) {
  if (bytes < 1024) return t("fileSize.bytes", { n: bytes });
  if (bytes < 1024 * 1024) return t("fileSize.kb", { n: Math.round(bytes / 1024) });
  return t("fileSize.mb", { n: (bytes / 1024 / 1024).toFixed(1) });
}

export default function TaskPane() {
  const { t, dir } = useI18n();
  const { taskId, open, close } = useTaskPane();
  /** مقابل الشريط الجانبي: يمين في الإنجليزية (LTR)، يسار في العربية (RTL) */
  const sheetSide =
    "fixed inset-y-0 end-0 z-40 w-full max-w-2xl border-s border-line bg-surface shadow-xl";
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

  // تمدد العنوان تلقائيًا على قدر النص عند الفتح
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [taskId, task?.title]);
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
      <aside className={clsx("masar-sheet p-6 text-sm text-ink-3", sheetSide)}>
        {t("loading")}
      </aside>
    );

  const activityLabel = (action: string) => {
    const key = `activity.${action}` as MsgKey;
    const label = t(key);
    return label === key ? "" : label;
  };

  const me = meData ?? null;
  const isCollaborator = me ? task.watchers.some((w) => w.userId === me.id) : false;
  const openDeps = task.dependencies.filter((d) => d.task && !d.task.isCompleted);
  const doneSubtasks = task.subtasks.filter((s) => s.isCompleted).length;

  const feed: Array<
    | { kind: "activity"; id: string; at: string; node: React.ReactNode }
    | { kind: "comment"; id: string; at: string; c: TaskDetail["comments"][number] }
  > = [
    ...task.activity
      .filter((a) => activityLabel(a.action))
      .map((a) => ({
        kind: "activity" as const,
        id: `a${a.id}`,
        at: a.createdAt,
        node: (
          <span>
            <b>{a.user?.name ?? t("activity.system")}</b> {activityLabel(a.action)}
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
      <aside className={clsx("masar-sheet flex flex-col", sheetSide)}>
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
            {task.isCompleted ? t("tasks.completedStatus") : t("tasks.complete")}
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
            title={t("tasks.like")}
          >
            <ThumbsUp size={15} />
            {task.likes.length > 0 && <span className="tabular-nums">{task.likes.length}</span>}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-field p-1.5 text-ink-3 hover:text-saffron"
            title={t("tasks.attachFile")}
          >
            <Paperclip size={15} />
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/task/${task.id}`).then(
                () => flash(t("tasks.linkCopied")),
                () => flash(t("tasks.copyFailed")),
              );
            }}
            className="rounded-field p-1.5 text-ink-3 hover:text-saffron"
            title={t("tasks.copyLink")}
          >
            <Link2 size={15} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-field p-1.5 text-ink-3 hover:text-ink"
              title={t("more")}
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
                <Copy size={13} /> {t("tasks.duplicate")}
              </button>
              <div className="my-1 border-t border-line-soft" />
              <div className="px-2 py-1 text-[10px] font-bold text-ink-3">{t("tasks.taskType")}</div>
              {(
                [
                  ["task", t("tasks.typeNormal")],
                  ["milestone", t("tasks.typeMilestone")],
                  ["approval", t("tasks.typeApproval")],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => {
                    setMenuOpen(false);
                    patch.mutate({ taskType: type });
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft",
                    task.taskType === type && "text-saffron",
                  )}
                >
                  {type === "milestone" ? <Diamond size={12} /> : <Check size={12} />} {label}
                </button>
              ))}
              <div className="my-1 border-t border-line-soft" />
              <button
                onClick={() => {
                  if (!confirm(t("tasks.deleteConfirm"))) return;
                  setMenuOpen(false);
                  act.mutate({ method: "DELETE", url: key });
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <Trash2 size={13} /> {t("tasks.deleteTask")}
              </button>
            </Popover>
          </div>
          <button onClick={close} className="rounded-field p-1.5 text-ink-3 hover:text-ink" title={`${t("close")} (Esc)`}>
            {dir === "ltr" ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ─── تنبيهات ─── */}
          {task.parent && (
            <button
              onClick={() => open(task.parent!.id)}
              className="mx-4 mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-saffron"
            >
              <span className="text-ink-3">{t("tasks.subtaskOf")}</span>
              <span className="underline decoration-dotted">{task.parent.title}</span>
            </button>
          )}
          {openDeps.length > 0 && !task.isCompleted && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-field border border-wait/40 bg-wait/10 px-3 py-2 text-xs font-semibold text-wait">
              <Lock size={14} className="mt-0.5 flex-none" />
              <div>
                {t("tasks.blockedByAlert")}
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
                {t("tasks.approval")}
                {task.approvalStatus === "approved" && t("tasks.approved")}
                {task.approvalStatus === "changes_requested" && t("tasks.changesRequested")}
                {task.approvalStatus === "rejected" && t("tasks.rejected")}
              </div>
              {task.approvalStatus === "pending" && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "approved" } })}
                    className="rounded-field bg-success px-3 py-1 text-xs font-bold text-paper hover:opacity-90"
                  >
                    {t("tasks.approve")}
                  </button>
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "changes_requested" } })}
                    className="rounded-field border border-wait px-3 py-1 text-xs font-bold text-wait hover:bg-wait/10"
                  >
                    {t("tasks.requestChanges")}
                  </button>
                  <button
                    onClick={() => act.mutate({ method: "POST", url: `${key}/approval`, body: { decision: "rejected" } })}
                    className="rounded-field border border-danger px-3 py-1 text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    {t("tasks.reject")}
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
            <FieldRow label={t("tasks.assignee")}>
              <AssigneePicker
                value={task.assignee ?? null}
                onChange={(userId) => patch.mutate({ assigneeId: userId })}
              />
            </FieldRow>
            <FieldRow label={t("tasks.due")}>
              <DueDatePicker
                value={task.dueAt}
                isCompleted={task.isCompleted}
                onChange={(iso) => patch.mutate({ dueAt: iso })}
              />
            </FieldRow>
            <FieldRow label={t("tasks.startDate")}>
              <DueDatePicker
                value={task.startAt}
                isCompleted={task.isCompleted}
                onChange={(iso) => patch.mutate({ startAt: iso })}
              />
            </FieldRow>
            <FieldRow label={t("tasks.project")}>
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
                  <option value="">{t("tasks.noProject")}</option>
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
                    <option value="">{t("tasks.noSection")}</option>
                    {(projectDetail?.sections ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </FieldRow>
            <FieldRow label={t("tasks.priority")}>
              <PriorityPicker value={task.priority} onChange={(p) => patch.mutate({ priority: p })} />
            </FieldRow>
            <FieldRow label={t("tasks.tags")}>
              <TagsEditor tags={task.tags} onChange={(tags) => patch.mutate({ tags })} />
            </FieldRow>
            {task.linkUrl && (
              <FieldRow label={t("tasks.referenceLink")}>
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
            <div className="mb-1 text-xs font-bold text-ink-2">{t("tasks.description")}</div>
            <textarea
              key={task.id + (task.description ?? "")}
              defaultValue={task.description ?? ""}
              placeholder={t("tasks.descriptionPlaceholder")}
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
                {t("tasks.subtasks")}
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
                  {s.assignee && <Avatar name={s.assignee.name} color={s.assignee.avatarColor} src={s.assignee.avatarUrl} size={5} />}
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
                    placeholder={t("tasks.subtaskName")}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-ink-3 hover:text-saffron"
                >
                  <Plus size={13} /> {t("tasks.addSubtask")}
                </button>
              )}
            </div>
          </div>

          {/* ─── الاعتماديات ─── */}
          <div className="mt-3 px-6">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-bold text-ink-2">{t("tasks.blockedBy")}</div>
              <div className="relative">
                <button
                  onClick={() => setDepOpen(!depOpen)}
                  className="flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-saffron"
                >
                  <Plus size={12} /> {t("tasks.addDependency")}
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
                      {d.task?.title ?? t("tasks.deletedTask")}
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
              <div className="text-xs text-ink-3">{t("tasks.dependencies")}</div>
            )}
          </div>

          {/* ─── المرفقات ─── */}
          {task.attachments.length > 0 && (
            <div className="mt-3 px-6">
              <div className="mb-1 text-xs font-bold text-ink-2">{t("tasks.attachments")}</div>
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
                    <span className="flex-none text-[10px] text-ink-3 tabular-nums">{fmtSize(a.size, t)}</span>
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
              <span className="text-xs font-bold text-ink-2">{t("tasks.collaborators")}</span>
              <div className="flex -space-x-1 space-x-reverse">
                {task.watchers.map((w) => (
                  <Avatar key={w.userId} name={w.user.name} color={w.user.avatarColor} src={w.user.avatarUrl} size={6} />
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setCollabOpen(!collabOpen)}
                  className="flex h-6 w-6 items-center justify-center rounded-chip border border-dashed border-ink-3/50 text-ink-3 hover:border-saffron hover:text-saffron"
                  title={t("tasks.addCollaborator")}
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
                        <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} size={6} />
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
                  {isCollaborator ? t("tasks.leave") : t("tasks.join")}
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
            {feed.length === 0 && <div className="text-xs text-ink-3">{t("tasks.noActivity")}</div>}
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
            {me && <Avatar name={me.name} color={me.avatarColor} src={me.avatarUrl} size={7} />}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
                }
              }}
              placeholder={t("tasks.commentPlaceholder")}
              rows={comment.includes("\n") ? 3 : 1}
              className="min-w-0 flex-1 resize-none rounded-field border border-line bg-paper px-3 py-1.5 text-sm focus:border-saffron focus:outline-none"
            />
            <button
              type="submit"
              disabled={!comment.trim()}
              className="rounded-field bg-accent px-3 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
            >
              {t("tasks.comment")}
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
            if (!res.ok) flash((await res.json().catch(() => ({})))?.error ?? t("tasks.uploadFailed"));
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
  c: {
    id: number;
    content: string;
    createdAt: string;
    user: { id: number; name: string; avatarColor: string; avatarUrl?: string | null };
    likes: { userId: number }[];
  };
  meId: number;
  act: any;
}) {
  const liked = c.likes.some((l) => l.userId === meId);
  return (
    <div className="flex items-start gap-2">
      <Avatar name={c.user.name} color={c.user.avatarColor} src={c.user.avatarUrl} size={7} />
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

/** محرر الوسوم — أقراص تُضاف بـEnter وتُحذف بالنقر */
function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim().replace(/,/g, "");
    if (v && !tags.includes(v) && tags.length < 20) onChange([...tags, v]);
    setValue("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onChange(tags.filter((x) => x !== tag))}
          className="group flex items-center gap-1 rounded-chip bg-line-soft px-2 py-0.5 text-[11px] font-bold text-ink-2 hover:bg-danger/10 hover:text-danger"
          title={t("tasks.removeTag")}
        >
          {tag}
          <X size={10} className="opacity-0 group-hover:opacity-100" />
        </button>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={tags.length ? "" : t("tasks.addTag")}
        className="w-24 bg-transparent text-xs focus:outline-none"
      />
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
  const { t } = useI18n();
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
        placeholder={t("tasks.dependencySearch")}
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
        {!candidates.length && <div className="px-2 py-3 text-center text-xs text-ink-3">{t("noResults")}</div>}
      </div>
    </Popover>
  );
}
