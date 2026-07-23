import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Archive,
  BookmarkPlus,
  Calendar,
  GanttChartSquare,
  LayoutGrid,
  List,
  MoreHorizontal,
  Newspaper,
  Search,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { Me, ProjectRow, StatusUpdateRow, TaskRow, UserLite } from "../lib/types";
import { PROJECT_COLORS, PROJECT_STATUS_META, type ProjectStatusType } from "../lib/types";
import { Avatar, ErrorBar, Spinner } from "../components/bits";
import { Popover } from "../components/pickers";
import TaskList, { type ListGroup } from "../components/TaskList";
import TaskBoard from "../components/TaskBoard";
import Timeline from "../components/Timeline";
import CalendarMonth from "../components/CalendarMonth";
import { relTime } from "../lib/dates";
import type { MsgKey } from "../locales/en";
import { useI18n } from "../lib/i18n";

type Tab = "overview" | "list" | "board" | "timeline" | "calendar";

const TABS: { key: Tab; labelKey: MsgKey; icon: typeof List }[] = [
  { key: "overview", labelKey: "tasks.overview", icon: Newspaper },
  { key: "list", labelKey: "tasks.list", icon: List },
  { key: "board", labelKey: "tasks.board", icon: LayoutGrid },
  { key: "timeline", labelKey: "tasks.timeline", icon: GanttChartSquare },
  { key: "calendar", labelKey: "tasks.calendar", icon: Calendar },
];

export default function ProjectPage({ id, me }: { id: number; me: Me }) {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (localStorage.getItem(`masar-proj-${id}`) as Tab) || "list";
    } catch {
      return "list";
    }
  });
  const [q, setQ] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<number | "">("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectKey = `/api/projects/${id}`;
  const tasksKey = `/api/tasks?projectId=${id}&roots=1${showCompleted ? "" : "&completed=0"}`;
  const { data: project } = useQuery<ProjectRow | null>({ queryKey: [projectKey] });
  const { data: tasksData, isLoading } = useQuery<TaskRow[] | null>({ queryKey: [tasksKey] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });

  const allTasks = Array.isArray(tasksData) ? tasksData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const canManage = me.permissions.includes("*") || me.permissions.includes("projects.manage");

  const tasks = useMemo(
    () =>
      allTasks.filter((t) => {
        if (q && !t.title.includes(q)) return false;
        if (filterAssignee !== "" && t.assigneeId !== filterAssignee) return false;
        return true;
      }),
    [allTasks, q, filterAssignee],
  );

  const sections = project?.sections ?? [];
  const hasOrphans = tasks.some((t) => !t.sectionId || !sections.some((s) => s.id === t.sectionId));
  const groups: ListGroup[] = useMemo(() => {
    const gs: ListGroup[] = sections.map((s) => ({
      id: s.id,
      title: s.title,
      deletable: canManage,
      renamable: canManage,
    }));
    if (hasOrphans) gs.unshift({ id: null, title: t("tasks.noSection") });
    return gs;
  }, [sections, hasOrphans, canManage, t]);

  function flash(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  function pickTab(t: Tab) {
    setTab(t);
    try {
      localStorage.setItem(`masar-proj-${id}`, t);
    } catch {}
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [tasksKey] });
    queryClient.invalidateQueries({ queryKey: [projectKey] });
  };

  const patchProject = useMutation({
    mutationFn: (fields: Record<string, unknown>) => api("PATCH", projectKey, fields),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (e: Error) => flash(e.message),
  });

  const reorder = useMutation({
    mutationFn: ({ orderedIds, groupId }: { movedId: number; groupId: number | null; orderedIds: number[] }) =>
      api("POST", "/api/tasks/reorder", {
        items: orderedIds.map((tid, i) => ({ id: tid, sectionId: groupId, orderIndex: i })),
      }),
    onMutate: async ({ movedId, groupId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) =>
        (old ?? []).map((t) => {
          const at = orderedIds.indexOf(t.id);
          if (t.id === movedId) return { ...t, sectionId: groupId, orderIndex: at };
          if (at !== -1) return { ...t, orderIndex: at };
          return t;
        }),
      );
    },
    onSettled: invalidate,
    onError: (e: Error) => flash(e.message),
  });

  const addTask = useMutation({
    mutationFn: ({ title, groupId }: { title: string; groupId: number | null }) =>
      api("POST", "/api/tasks", { title, projectId: id, sectionId: groupId }),
    onMutate: async ({ title, groupId }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      const prev = queryClient.getQueryData<TaskRow[] | null>([tasksKey]);
      const optimistic = {
        id: -Date.now(),
        title,
        description: null,
        isCompleted: false,
        completedAt: null,
        taskType: "task" as const,
        approvalStatus: null,
        priority: null,
        tags: [] as string[],
        assigneeId: null,
        projectId: id,
        sectionId: groupId,
        parentTaskId: null,
        orderIndex: 9999,
        myTasksSectionId: null,
        myTasksOrderIndex: 0,
        dueAt: null,
        startAt: null,
        linkUrl: null,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignee: null,
        project: project
          ? { id: project.id, name: project.name, color: project.color }
          : null,
        section: groupId
          ? { id: groupId, title: sections.find((s) => s.id === groupId)?.title ?? "" }
          : null,
        subtasks: [],
      } satisfies TaskRow;
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData([tasksKey], ctx.prev);
      flash(e.message);
    },
    onSettled: invalidate,
  });

  const patchTask = useMutation({
    mutationFn: ({ tid, fields }: { tid: number; fields: Record<string, unknown> }) =>
      api("PATCH", `/api/tasks/${tid}`, fields),
    onMutate: async ({ tid, fields }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) =>
        (old ?? []).map((t) => (t.id === tid ? { ...t, ...fields } : t)),
      );
    },
    onSettled: invalidate,
    onError: (e: Error) => flash(e.message),
  });

  const sectionOp = useMutation({
    mutationFn: ({ method, url, body }: { method: "POST" | "PATCH" | "DELETE"; url: string; body?: unknown }) =>
      api(method, url, body),
    onSuccess: invalidate,
    onError: (e: Error) => flash(e.message),
  });

  const star = useMutation({
    mutationFn: () => api(project?.isStarred ? "DELETE" : "POST", `${projectKey}/star`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const saveTemplate = useMutation({
    mutationFn: (name: string) => api("POST", `${projectKey}/save-template`, { name }),
    onSuccess: () => flash(t("projects.templateSaved")),
    onError: (e: Error) => flash(e.message),
  });

  if (!project) return <Spinner />;

  const statusMeta = project.currentStatus ? PROJECT_STATUS_META[project.currentStatus] : null;
  const statusLabel = project.currentStatus
    ? t(`status.${project.currentStatus}` as MsgKey)
    : null;

  const common = {
    groups,
    tasks,
    groupOf: (t: TaskRow) => (sections.some((s) => s.id === t.sectionId) ? t.sectionId : null),
    orderOf: (t: TaskRow) => t.orderIndex,
    onReorder: (movedId: number, groupId: number | null, orderedIds: number[]) =>
      reorder.mutate({ movedId, groupId, orderedIds }),
    onAddTask: (title: string, groupId: number | null) => addTask.mutate({ title, groupId }),
    onPatchTask: (tid: number, fields: Record<string, unknown>) => patchTask.mutate({ tid, fields }),
    onAddGroup: (title: string) =>
      sectionOp.mutate({ method: "POST", url: `${projectKey}/sections`, body: { title } }),
  };

  return (
    <div>
      {/* ─── رأس المشروع ─── */}
      <div className="mb-1 flex items-center gap-2.5">
        <div className="relative">
          <button
            onClick={() => canManage && setColorOpen(!colorOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-field text-sm font-bold text-paper"
            style={{ background: project.color }}
            title={canManage ? t("projects.changeColor") : undefined}
          >
            {project.name.slice(0, 1)}
          </button>
          <Popover open={colorOpen} onClose={() => setColorOpen(false)} className="w-44 p-2">
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    patchProject.mutate({ color: c });
                    setColorOpen(false);
                  }}
                  className={clsx("h-6 w-6 rounded-chip border-2", project.color === c ? "border-ink" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Popover>
        </div>

        {canManage ? (
          <input
            key={project.name}
            defaultValue={project.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== project.name) patchProject.mutate({ name: v });
              else e.target.value = project.name;
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 max-w-md flex-shrink truncate rounded-field border border-transparent bg-transparent px-1.5 py-0.5 font-display text-xl font-bold hover:border-line focus:border-saffron focus:outline-none"
          />
        ) : (
          <h1 className="truncate font-display text-xl font-bold">{project.name}</h1>
        )}

        <button
          onClick={() => star.mutate()}
          className={clsx("rounded p-1", project.isStarred ? "text-saffron" : "text-ink-3 hover:text-saffron")}
          title={project.isStarred ? t("projects.unstar") : t("projects.star")}
        >
          <Star size={17} fill={project.isStarred ? "currentColor" : "none"} />
        </button>

        {statusMeta && statusLabel && (
          <button
            onClick={() => pickTab("overview")}
            className="rounded-chip px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: statusMeta.color + "22", color: statusMeta.color }}
          >
            {statusLabel}
          </button>
        )}

        <div className="flex-1" />

        {/* الأعضاء + مشاركة */}
        <div className="hidden items-center sm:flex">
          <div className="flex -space-x-1.5 space-x-reverse">
            {(project.members ?? []).slice(0, 5).map((m) => (
              <Avatar key={m.userId} name={m.name} color={m.avatarColor} src={m.avatarUrl} size={7} />
            ))}
          </div>
          {(project.members?.length ?? 0) > 5 && (
            <span className="mr-1 text-[11px] font-bold text-ink-3">+{project.members!.length - 5}</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShareOpen(!shareOpen)}
            className="flex items-center gap-1.5 rounded-field border border-line px-2.5 py-1 text-xs font-bold text-ink-2 hover:border-saffron hover:text-saffron"
          >
            <UserPlus size={13} /> {t("projects.share")}
          </button>
          <Popover open={shareOpen} onClose={() => setShareOpen(false)} align="end" className="max-h-72 w-60 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-bold text-ink-3">{t("projects.projectMembers")}</div>
            {(project.members ?? []).map((m) => (
              <div key={m.userId} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-line-soft">
                <Avatar name={m.name} color={m.avatarColor} src={m.avatarUrl} size={6} />
                <span className="flex-1 truncate text-xs font-semibold">{m.name}</span>
                <button
                  onClick={() => sectionOp.mutate({ method: "DELETE", url: `${projectKey}/members/${m.userId}` })}
                  className="hidden text-[10px] font-bold text-ink-3 hover:text-danger group-hover:block"
                >
                  {t("projects.removeMember")}
                </button>
              </div>
            ))}
            <div className="mt-1 border-t border-line-soft px-2 py-1 text-[10px] font-bold text-ink-3">{t("projects.addMember")}</div>
            {users
              .filter((u) => !(project.members ?? []).some((m) => m.userId === u.id))
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() =>
                    sectionOp.mutate({ method: "POST", url: `${projectKey}/members`, body: { userId: u.id } })
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
                >
                  <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} size={6} />
                  {u.name}
                </button>
              ))}
          </Popover>
        </div>

        {canManage && (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="rounded p-1.5 text-ink-3 hover:text-ink">
              <MoreHorizontal size={16} />
            </button>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} align="end" className="w-52">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  const name = prompt(t("projects.templateNamePrompt"), t("projects.templateDefaultName", { name: project.name }));
                  if (name?.trim()) saveTemplate.mutate(name.trim());
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
              >
                <BookmarkPlus size={13} /> {t("projects.saveTemplate")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  patchProject.mutate({ status: project.status === "archived" ? "active" : "archived" });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
              >
                <Archive size={13} /> {project.status === "archived" ? t("projects.unarchive") : t("projects.archive")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (confirm(t("projects.deleteConfirmDetail", { name: project.name }))) {
                    api("DELETE", projectKey).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
                      navigate("/projects");
                    }, (e: Error) => flash(e.message));
                  }
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <Trash2 size={13} /> {t("projects.deleteProject")}
              </button>
            </Popover>
          </div>
        )}
      </div>

      {/* ─── التبويبات ─── */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => pickTab(key)}
            className={clsx(
              "flex flex-none items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold",
              tab === key ? "border-saffron text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            <Icon size={14} /> {t(labelKey)}
          </button>
        ))}
        <div className="flex-1" />
        {(tab === "list" || tab === "board" || tab === "timeline" || tab === "calendar") && (
          <div className="flex flex-none items-center gap-2 pb-1">
            <div className="flex h-7 items-center gap-1.5 rounded-field border border-line bg-surface px-2">
              <Search size={12} className="text-ink-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("projects.filter")}
                className="w-24 bg-transparent text-xs focus:outline-none"
              />
            </div>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value ? Number(e.target.value) : "")}
              className="hidden h-7 rounded-field border border-line bg-surface px-1.5 text-xs sm:block"
            >
              <option value="">{t("all")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <label className="flex cursor-pointer select-none items-center gap-1 text-xs font-semibold text-ink-3">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="accent-[var(--masar-saffron)]"
              />
              {t("tasks.showCompleted")}
            </label>
          </div>
        )}
      </div>

      {/* ─── المحتوى ─── */}
      {isLoading && tab !== "overview" ? (
        <Spinner />
      ) : tab === "overview" ? (
        <OverviewTab project={project} me={me} canManage={canManage} onPatch={(f) => patchProject.mutate(f)} t={t} />
      ) : tab === "list" ? (
        <TaskList
          {...common}
          showAssignee
          onRenameGroup={(gid, title) =>
            sectionOp.mutate({ method: "PATCH", url: `/api/sections/${gid}`, body: { title } })
          }
          onDeleteGroup={(gid) => sectionOp.mutate({ method: "DELETE", url: `/api/sections/${gid}` })}
        />
      ) : tab === "board" ? (
        <TaskBoard {...common} />
      ) : tab === "timeline" ? (
        <Timeline tasks={tasks} />
      ) : (
        <CalendarMonth tasks={tasks} />
      )}

      <ErrorBar message={error} />
    </div>
  );
}

/** نظرة عامة: الوصف + الأعضاء + تحديثات الحالة (نموذج أسانا) */
function OverviewTab({
  project,
  me,
  canManage,
  onPatch,
  t,
}: {
  project: ProjectRow;
  me: Me;
  canManage: boolean;
  onPatch: (fields: Record<string, unknown>) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const updatesKey = `/api/projects/${project.id}/status-updates`;
  const { data: updatesData } = useQuery<StatusUpdateRow[] | null>({ queryKey: [updatesKey] });
  const updates = Array.isArray(updatesData) ? updatesData : [];
  const [statusType, setStatusType] = useState<ProjectStatusType>("on_track");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const publish = useMutation({
    mutationFn: () =>
      api("POST", updatesKey, { statusType, title: title.trim() || null, body: body.trim() || null }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: [updatesKey] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold">{t("projects.about")}</h2>
          <textarea
            key={project.description ?? ""}
            defaultValue={project.description ?? ""}
            placeholder={t("projects.aboutPlaceholder")}
            rows={3}
            readOnly={!canManage}
            onBlur={(e) => {
              if (canManage && e.target.value !== (project.description ?? ""))
                onPatch({ description: e.target.value || null });
            }}
            className="w-full resize-y rounded-field border border-line-soft bg-transparent px-3 py-2 text-sm leading-relaxed focus:border-saffron focus:outline-none"
          />
        </section>

        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">{t("projects.statusUpdates")}</h2>
          <div className="mb-4 rounded-field border border-line-soft p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(Object.keys(PROJECT_STATUS_META) as ProjectStatusType[]).map((s) => {
                const meta = PROJECT_STATUS_META[s];
                const active = statusType === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusType(s)}
                    className={clsx("rounded-chip border px-2.5 py-1 text-[11px] font-bold transition")}
                    style={{
                      background: active ? meta.color : meta.color + "15",
                      color: active ? "#fff" : meta.color,
                      borderColor: active ? meta.color : "transparent",
                    }}
                  >
                    {t(`status.${s}` as MsgKey)}
                  </button>
                );
              })}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("projects.updateTitle")}
              className="mb-2 w-full rounded-field border border-line bg-paper px-3 py-1.5 text-sm focus:border-saffron focus:outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("projects.updateBody")}
              rows={2}
              className="mb-2 w-full resize-y rounded-field border border-line bg-paper px-3 py-1.5 text-sm focus:border-saffron focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
                className="rounded-field bg-accent px-3.5 py-1.5 text-xs font-bold text-paper hover:opacity-90 disabled:opacity-40"
              >
                {t("projects.publishUpdate")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {updates.map((u) => {
              const meta = PROJECT_STATUS_META[u.statusType];
              return (
                <div key={u.id} className="rounded-field border border-line-soft p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {u.createdBy && <Avatar name={u.createdBy.name} color={u.createdBy.avatarColor} src={u.createdBy.avatarUrl} size={6} />}
                    <span className="text-xs font-bold">{u.createdBy?.name}</span>
                    <span
                      className="rounded-chip px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: meta.color + "22", color: meta.color }}
                    >
                      {t(`status.${u.statusType}` as MsgKey)}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[10px] text-ink-3">{relTime(u.createdAt)}</span>
                  </div>
                  {u.title && <div className="text-sm font-bold">{u.title}</div>}
                  {u.body && <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink-2">{u.body}</div>}
                </div>
              );
            })}
            {!updates.length && (
              <div className="py-4 text-center text-xs text-ink-3">{t("projects.noStatusUpdates")}</div>
            )}
          </div>
        </section>
      </div>

      <div>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">{t("projects.members")}</h2>
          <div className="space-y-1.5">
            {(project.members ?? []).map((m) => (
              <div key={m.userId} className="flex items-center gap-2">
                <Avatar name={m.name} color={m.avatarColor} src={m.avatarUrl} size={7} />
                <span className="truncate text-xs font-semibold">{m.name}</span>
                {m.userId === project.ownerId && (
                  <span className="rounded-chip bg-line-soft px-1.5 text-[10px] font-bold text-ink-3">{t("projects.owner")}</span>
                )}
              </div>
            ))}
            {!(project.members ?? []).length && (
              <div className="text-xs text-ink-3">{t("projects.noMembersShare")}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
