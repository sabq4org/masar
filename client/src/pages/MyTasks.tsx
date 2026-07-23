import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Calendar, LayoutGrid, List } from "lucide-react";
import { api, queryClient } from "../lib/api";
import type { Me, MyTaskSection, TaskRow } from "../lib/types";
import { Avatar, ErrorBar, Spinner } from "../components/bits";
import TaskList, { type ListGroup } from "../components/TaskList";
import TaskBoard from "../components/TaskBoard";
import CalendarMonth from "../components/CalendarMonth";

type View = "list" | "board" | "calendar";

/** مهامي — نموذج أسانا: أقسام شخصية + قائمة/لوحة/تقويم */
export default function MyTasks() {
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem("masar-my-view") as View) || "list";
    } catch {
      return "list";
    }
  });
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: meData } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });
  const me = meData ?? null;
  const tasksKey = `/api/tasks?assigneeId=${me?.id ?? 0}&roots=1${showCompleted ? "" : "&completed=0"}`;
  const { data: tasksData, isLoading } = useQuery<TaskRow[] | null>({
    queryKey: [tasksKey],
    enabled: !!me,
  });
  const { data: sectionsData } = useQuery<MyTaskSection[] | null>({
    queryKey: ["/api/my-tasks/sections"],
  });

  const tasks = Array.isArray(tasksData) ? tasksData : [];
  const sections = Array.isArray(sectionsData) ? sectionsData : [];
  const defaultSection = sections.find((s) => s.isDefault) ?? sections[0];

  const groups: ListGroup[] = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        title: s.title,
        deletable: !s.isDefault,
        renamable: !s.isDefault,
      })),
    [sections],
  );

  // المهام بلا قسم شخصي تهبط في القسم الافتراضي «المسندة حديثًا»
  const groupOf = (t: TaskRow) =>
    t.myTasksSectionId && sections.some((s) => s.id === t.myTasksSectionId)
      ? t.myTasksSectionId
      : defaultSection?.id ?? null;

  function setView2(v: View) {
    setView(v);
    try {
      localStorage.setItem("masar-my-view", v);
    } catch {}
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [tasksKey] });

  const reorder = useMutation({
    mutationFn: ({ orderedIds, groupId }: { movedId: number; groupId: number | null; orderedIds: number[] }) =>
      api("POST", "/api/tasks/reorder", {
        items: orderedIds.map((id, i) => ({ id, myTasksSectionId: groupId, myTasksOrderIndex: i })),
      }),
    onMutate: async ({ movedId, groupId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) =>
        (old ?? []).map((t) => {
          const at = orderedIds.indexOf(t.id);
          if (t.id === movedId) return { ...t, myTasksSectionId: groupId, myTasksOrderIndex: at };
          if (at !== -1) return { ...t, myTasksOrderIndex: at };
          return t;
        }),
      );
    },
    onSettled: invalidate,
  });

  const [flash, setFlash] = useState<string | null>(null);
  const showError = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  };

  const addTask = useMutation({
    mutationFn: ({ title, groupId }: { title: string; groupId: number | null }) =>
      api("POST", "/api/tasks", {
        title,
        assigneeId: me?.id,
        myTasksSectionId: groupId,
      }),
    onMutate: async ({ title, groupId }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      const prev = queryClient.getQueryData<TaskRow[] | null>([tasksKey]);
      const optimistic: TaskRow = {
        id: -Date.now(),
        title,
        description: null,
        isCompleted: false,
        completedAt: null,
        taskType: "task",
        approvalStatus: null,
        priority: null,
        tags: [],
        assigneeId: me?.id ?? null,
        projectId: null,
        sectionId: null,
        parentTaskId: null,
        orderIndex: 0,
        myTasksSectionId: groupId,
        myTasksOrderIndex: 0,
        dueAt: null,
        startAt: null,
        linkUrl: null,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignee: me
          ? { id: me.id, name: me.name, avatarColor: me.avatarColor }
          : null,
        project: null,
        section: null,
        subtasks: [],
      };
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData([tasksKey], ctx.prev);
      showError(e.message);
    },
    onSettled: invalidate,
  });

  const patchTask = useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api("PATCH", `/api/tasks/${id}`, fields),
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: [tasksKey] });
      queryClient.setQueryData<TaskRow[] | null>([tasksKey], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...fields } : t)),
      );
    },
    onSettled: invalidate,
  });

  const addSection = useMutation({
    mutationFn: (title: string) => api("POST", "/api/my-tasks/sections", { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/sections"] }),
  });
  const renameSection = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      api("PATCH", `/api/my-tasks/sections/${id}`, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/sections"] }),
  });
  const deleteSection = useMutation({
    mutationFn: (id: number) => api("DELETE", `/api/my-tasks/sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/sections"] });
      invalidate();
    },
  });

  const VIEWS: { key: View; label: string; icon: typeof List }[] = [
    { key: "list", label: "قائمة", icon: List },
    { key: "board", label: "لوحة", icon: LayoutGrid },
    { key: "calendar", label: "تقويم", icon: Calendar },
  ];

  if (!me) return <Spinner />;

  const common = {
    groups,
    tasks,
    groupOf,
    orderOf: (t: TaskRow) => t.myTasksOrderIndex,
    onReorder: (movedId: number, groupId: number | null, orderedIds: number[]) =>
      reorder.mutate({ movedId, groupId, orderedIds }),
    onAddTask: (title: string, groupId: number | null) => addTask.mutate({ title, groupId }),
    onPatchTask: (id: number, fields: Record<string, unknown>) => patchTask.mutate({ id, fields }),
    onAddGroup: (title: string) => addSection.mutate(title),
  };

  return (
    <div>
      <ErrorBar message={flash} />
      {/* ─── الرأس ─── */}
      <div className="mb-1 flex items-center gap-3">
        <Avatar name={me.name} color={me.avatarColor} src={me.avatarUrl} size={9} />
        <h1 className="font-display text-xl font-bold">مهامي</h1>
      </div>
      <div className="mb-3 flex items-center gap-1 border-b border-line">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView2(key)}
            className={clsx(
              "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold",
              view === key
                ? "border-saffron text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
        <div className="flex-1" />
        <label className="flex cursor-pointer select-none items-center gap-1.5 pb-1 text-xs font-semibold text-ink-3">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-[var(--masar-saffron)]"
          />
          إظهار المكتملة
        </label>
      </div>

      {isLoading ? (
        <Spinner />
      ) : view === "list" ? (
        <TaskList
          {...common}
          showAssignee={false}
          showProject
          onRenameGroup={(id, title) => renameSection.mutate({ id, title })}
          onDeleteGroup={(id) => deleteSection.mutate(id)}
        />
      ) : view === "board" ? (
        <TaskBoard {...common} />
      ) : (
        <CalendarMonth tasks={tasks} />
      )}
    </div>
  );
}
