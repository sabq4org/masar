import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, ChevronLeft, Plus, Users } from "lucide-react";
import type { Me, ProjectRow, TaskRow, UserLite } from "../lib/types";
import { greeting, todayLine } from "../lib/dates";
import { Avatar, CheckCircle, CollaboratorStack, DueText, ProjectDot, Spinner } from "../components/bits";
import { NewProjectModal } from "../components/Layout";
import { useTaskPane } from "../lib/taskPane";
import { api, queryClient } from "../lib/api";
import { useI18n, useRoleLabel } from "../lib/i18n";
import ActivityFeed from "../components/ActivityFeed";

/** الرئيسية — نموذج أسانا: تحية، إحصاءات، وبطاقات مهامي والمشاريع والأشخاص */
export default function Home({ me }: { me: Me }) {
  const { t } = useI18n();
  const roleLabel = useRoleLabel();
  const pane = useTaskPane();
  const [tab, setTab] = useState<"upcoming" | "overdue" | "completed">("upcoming");
  const [newProject, setNewProject] = useState(false);

  // نفس عقد «مهامي»: المسندة إليّ فقط (لا كل ما أنشأته كمدير)
  const myKey = `/api/tasks?mine=1&roots=1`;
  const { data: tasksData, isLoading } = useQuery<TaskRow[] | null>({ queryKey: [myKey] });
  const { data: projectsData } = useQuery<ProjectRow[] | null>({ queryKey: ["/api/projects"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });

  const tasks = Array.isArray(tasksData) ? tasksData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const users = Array.isArray(usersData) ? usersData : [];

  const weekAgo = Date.now() - 7 * 86400_000;
  const doneThisWeek = tasks.filter(
    (t) => t.isCompleted && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo,
  ).length;

  const lists = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const open = tasks.filter((t) => !t.isCompleted);
    return {
      upcoming: open.filter((t) => !t.dueAt || new Date(t.dueAt) >= today),
      overdue: open.filter((t) => t.dueAt && new Date(t.dueAt) < today),
      completed: tasks.filter((t) => t.isCompleted),
    };
  }, [tasks]);

  const patch = (id: number, fields: Record<string, unknown>) =>
    api("PATCH", `/api/tasks/${id}`, fields).then(() =>
      queryClient.invalidateQueries({ queryKey: [myKey] }),
    );

  const TABS = [
    { key: "upcoming" as const, label: t("home.upcoming") },
    { key: "overdue" as const, label: t("home.overdue"), count: lists.overdue.length },
    { key: "completed" as const, label: t("home.completed") },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* ─── الترحيب ─── */}
      <div className="mb-6 text-center">
        <div className="text-sm text-ink-3">{todayLine()}</div>
        <h1 className="mt-1 font-display text-2xl font-bold">{greeting(me.name)}</h1>
        <div className="mt-3 inline-flex items-center gap-4 rounded-chip border border-line bg-surface px-5 py-2 text-xs font-semibold text-ink-2">
          <span className="flex items-center gap-1.5">
            <Check size={14} className="text-success" />
            {t("home.doneThisWeek", { n: doneThisWeek })}
          </span>
          <span className="h-4 w-px bg-line" />
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-review" />
            {t("home.members", { n: users.length })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ─── بطاقة مهامي ─── */}
        <section className="rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-line-soft px-4 pt-3">
            <Avatar name={me.name} color={me.avatarColor} src={me.avatarUrl} size={8} />
            <div className="flex-1">
              <Link href="/my" className="text-sm font-bold hover:text-saffron">
                {t("home.myTasks")}
              </Link>
              <div className="flex gap-4 pt-1.5">
                {TABS.map((tabItem) => (
                  <button
                    key={tabItem.key}
                    onClick={() => setTab(tabItem.key)}
                    className={clsx(
                      "border-b-2 pb-1.5 text-xs font-semibold",
                      tab === tabItem.key
                        ? "border-saffron text-ink"
                        : "border-transparent text-ink-3 hover:text-ink",
                    )}
                  >
                    {tabItem.label}
                    {"count" in tabItem && (tabItem.count ?? 0) > 0 && (
                      <span className="ms-1 rounded-chip bg-danger/10 px-1.5 text-[10px] font-bold text-danger tabular-nums">
                        {tabItem.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading && <Spinner />}
            {(lists[tab] ?? []).slice(0, 12).map((task) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => pane.open(task.id)}
                onKeyDown={(e) => e.key === "Enter" && pane.open(task.id)}
                className="flex h-10 w-full cursor-pointer items-center gap-2.5 border-b border-line-soft px-4 text-start text-sm hover:bg-line-soft/40"
              >
                <CheckCircle
                  checked={task.isCompleted}
                  size={16}
                  onToggle={(next) => patch(task.id, { isCompleted: next })}
                />
                <span className={clsx("min-w-0 flex-1 truncate font-semibold", task.isCompleted && "text-ink-3")}>
                  {task.title}
                </span>
                <CollaboratorStack
                  people={(task.watchers ?? []).map((w: NonNullable<TaskRow["watchers"]>[number]) => w.user)}
                  max={3}
                  size={5}
                />
                {task.project && (
                  <span className="hidden max-w-32 flex-none items-center gap-1 truncate text-[11px] text-ink-3 sm:flex">
                    <ProjectDot color={task.project.color} size={7} />
                    <span className="truncate">{task.project.name}</span>
                  </span>
                )}
                <DueText task={task} />
              </div>
            ))}
            {!isLoading && !(lists[tab] ?? []).length && (
              <div className="px-4 py-10 text-center text-xs text-ink-3">
                {tab === "overdue" ? t("home.noOverdue") : t("home.noTasks")}
              </div>
            )}
          </div>
          <Link
            href="/my"
            className="flex items-center justify-center gap-1 border-t border-line-soft py-2 text-xs font-semibold text-ink-3 hover:text-saffron"
          >
            {t("home.viewAllMyTasks")} <ChevronLeft size={13} />
          </Link>
        </section>

        {/* ─── بطاقة المشاريع ─── */}
        <section className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">{t("home.projects")}</span>
            <Link href="/projects" className="text-xs font-semibold text-ink-3 hover:text-saffron">
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => setNewProject(true)}
              className="flex items-center gap-2.5 rounded-field border border-dashed border-line px-3 py-2.5 text-xs font-bold text-ink-3 hover:border-saffron hover:text-saffron"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-field border border-dashed border-current">
                <Plus size={16} />
              </span>
              {t("home.createProject")}
            </button>
            {projects.slice(0, 7).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-2.5 rounded-field border border-transparent px-3 py-2.5 hover:border-line hover:bg-line-soft/40"
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-field text-sm font-bold text-paper"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{p.name}</span>
                  <span className="block text-[11px] text-ink-3 tabular-nums">
                    {t("home.projectTaskSummary", { tasks: p.taskCount ?? 0, done: p.doneCount ?? 0 })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── خط النشاط: كل خطوة في المساحة ─── */}
        <ActivityFeed />

        {/* ─── بطاقة الأشخاص ─── */}
        <section className="rounded-card border border-line bg-surface p-4 shadow-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">{t("home.people")}</span>
            <Link href="/teams" className="text-xs font-semibold text-ink-3 hover:text-saffron">
              {t("home.viewTeams")}
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {users.map((u) => (
              <div key={u.id} className="flex w-24 flex-col items-center gap-1 rounded-field px-2 py-2 text-center hover:bg-line-soft/40">
                <Avatar name={u.name} color={u.avatarColor} src={u.avatarUrl} size={9} />
                <span className="w-full truncate text-[11px] font-semibold">{u.name}</span>
                <span className="text-[10px] text-ink-3">{roleLabel(u.role)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
    </div>
  );
}
