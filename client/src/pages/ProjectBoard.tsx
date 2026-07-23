import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, ArrowRight, Search, LayoutGrid, List, GanttChartSquare, BookmarkPlus } from "lucide-react";
import { Link } from "wouter";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { Me, ProjectRow, StatusRow, TaskRow, UserLite } from "../lib/types";
import { Avatar, DueBadge, PriorityChip, StatusChip } from "../components/bits";
import TaskSheet from "../components/TaskSheet";
import Timeline from "../components/Timeline";

type ViewMode = "board" | "list" | "timeline";

export default function ProjectBoard({ id }: { id: number }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragTask, setDragTask] = useState<TaskRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [view, setView] = useState<ViewMode>("board");
  const [q, setQ] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<number | "">("");
  const [filterPriority, setFilterPriority] = useState("");

  const { data: me } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });
  const { data: project } = useQuery<ProjectRow | null>({ queryKey: [`/api/projects/${id}`] });
  const { data: statusesData } = useQuery<StatusRow[] | null>({ queryKey: ["/api/statuses"] });
  const { data: usersData } = useQuery<UserLite[] | null>({ queryKey: ["/api/users"] });
  const tasksKey = `/api/tasks?projectId=${id}&roots=1`;
  const { data: tasksData } = useQuery<TaskRow[] | null>({ queryKey: [tasksKey] });

  const statuses = Array.isArray(statusesData) ? statusesData : [];
  const users = Array.isArray(usersData) ? usersData : [];
  const allTasks = Array.isArray(tasksData) ? tasksData : [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const canManage =
    me && (me.permissions.includes("*") || me.permissions.includes("projects.manage"));

  const tasks = useMemo(
    () =>
      allTasks.filter((t) => {
        if (q && !t.title.includes(q)) return false;
        if (filterAssignee !== "" && t.assigneeId !== filterAssignee) return false;
        if (filterPriority && t.priority !== filterPriority) return false;
        return true;
      }),
    [allTasks, q, filterAssignee, filterPriority],
  );

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  const changeStatus = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: number; statusId: number }) =>
      api("POST", `/api/tasks/${taskId}/status`, { statusId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tasksKey] }),
    onError: (e: Error) => {
      showError(e.message);
      queryClient.invalidateQueries({ queryKey: [tasksKey] });
    },
  });

  const addTask = useMutation({
    mutationFn: ({ title, statusId }: { title: string; statusId: number }) =>
      api("POST", "/api/tasks", { title, statusId, projectId: id }),
    onSuccess: () => {
      setNewTitle("");
      setAddingIn(null);
      queryClient.invalidateQueries({ queryKey: [tasksKey] });
    },
    onError: (e: Error) => showError(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: (name: string) => api("POST", `/api/projects/${id}/save-template`, { name }),
    onSuccess: () => showError("حُفظ القالب — تجده في صفحة القوالب"),
    onError: (e: Error) => showError(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    setDragTask(null);
    const taskId = Number(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const statusId = Number(String(overId).replace("col-", ""));
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.statusId === statusId) return;
    changeStatus.mutate({ taskId, statusId });
  }

  const VIEWS: { key: ViewMode; label: string; icon: typeof List }[] = [
    { key: "board", label: "كانبان", icon: LayoutGrid },
    { key: "list", label: "قائمة", icon: List },
    { key: "timeline", label: "خط زمني", icon: GanttChartSquare },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <Link href="/projects" className="text-ink-3 hover:text-saffron"><ArrowRight size={18} /></Link>
        <span className="h-3 w-3 rounded-chip" style={{ background: project?.color }} />
        <h1 className="flex-1 truncate text-xl font-extrabold">{project?.name ?? "…"}</h1>
        {canManage && (
          <button
            onClick={() => {
              const name = prompt("اسم القالب:", `قالب — ${project?.name ?? ""}`);
              if (name?.trim()) saveTemplate.mutate(name.trim());
            }}
            className="flex items-center gap-1.5 rounded-field border border-line px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-line-soft"
          >
            <BookmarkPlus size={14} /> حفظ كقالب
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-field border border-line bg-surface p-0.5">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={clsx(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold",
                view === key ? "bg-accent-soft text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="flex h-8 items-center gap-1.5 rounded-field border border-line bg-surface px-2.5">
          <Search size={13} className="text-ink-3" />
          <input
            id="masar-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث… (/)"
            className="w-28 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value ? Number(e.target.value) : "")}
          className="h-8 rounded-field border border-line bg-surface px-2 text-xs"
        >
          <option value="">كل المسؤولين</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-8 rounded-field border border-line bg-surface px-2 text-xs"
        >
          <option value="">كل الأولويات</option>
          <option value="urgent">عاجلة</option>
          <option value="high">عالية</option>
          <option value="normal">عادية</option>
          <option value="low">منخفضة</option>
        </select>
        {(q || filterAssignee !== "" || filterPriority) && (
          <button
            onClick={() => { setQ(""); setFilterAssignee(""); setFilterPriority(""); }}
            className="text-xs font-semibold text-saffron hover:underline"
          >
            مسح الفلاتر ({tasks.length}/{allTasks.length})
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-field border border-wait/30 bg-wait/10 px-4 py-2 text-sm font-semibold text-wait">
          {error}
        </div>
      )}

      {view === "board" && (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDragTask(tasks.find((t) => t.id === Number(e.active.id)) ?? null)}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-4">
            {statuses.map((s) => (
              <Column
                key={s.id}
                status={s}
                tasks={tasks.filter((t) => t.statusId === s.id)}
                onOpen={setOpenId}
                adding={addingIn === s.id}
                newTitle={newTitle}
                setNewTitle={setNewTitle}
                onStartAdd={() => setAddingIn(s.id)}
                onSubmitAdd={() => {
                  if (newTitle.trim()) addTask.mutate({ title: newTitle.trim(), statusId: s.id });
                  else setAddingIn(null);
                }}
              />
            ))}
          </div>
          <DragOverlay>{dragTask && <Card task={dragTask} overlay />}</DragOverlay>
        </DndContext>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-field border border-line bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-right text-[11px] text-ink-2">
                <th className="px-3 py-2 font-bold">المهمة</th>
                <th className="px-3 py-2 font-bold">الحالة</th>
                <th className="px-3 py-2 font-bold">الأولوية</th>
                <th className="px-3 py-2 font-bold">المسؤول</th>
                <th className="px-3 py-2 font-bold">الاستحقاق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {tasks.map((t) => (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="h-10 cursor-pointer hover:bg-line-soft/50">
                  <td className="px-3 py-1.5 font-semibold">{t.title}</td>
                  <td className="px-3 py-1.5"><StatusChip status={t.status} /></td>
                  <td className="px-3 py-1.5"><PriorityChip priority={t.priority} /></td>
                  <td className="px-3 py-1.5">
                    {t.assignee ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={6} />
                        <span className="text-xs">{t.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5"><DueBadge task={t} /></td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-3">لا مهام مطابقة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === "timeline" && <Timeline tasks={tasks} onOpen={setOpenId} />}

      {openId && <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Column({
  status, tasks, onOpen, adding, newTitle, setNewTitle, onStartAdd, onSubmitAdd,
}: {
  status: StatusRow;
  tasks: TaskRow[];
  onOpen: (id: number) => void;
  adding: boolean;
  newTitle: string;
  setNewTitle: (v: string) => void;
  onStartAdd: () => void;
  onSubmitAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status.id}` });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex w-60 flex-none flex-col rounded-field border bg-paper p-1.5",
        isOver ? "border-saffron bg-accent-soft/50" : "border-line",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 px-1.5 py-1">
        <span className="h-1.5 w-1.5 rounded-chip" style={{ background: status.color }} />
        <span className="flex-1 text-xs font-bold" style={{ color: status.color }}>{status.nameAr}</span>
        <span className="text-[11px] tabular-nums text-ink-3">{tasks.length}</span>
        <button onClick={onStartAdd} className="text-ink-3 hover:text-saffron" title="إضافة"><Plus size={14} /></button>
      </div>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); onSubmitAdd(); }} className="mb-1.5">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={onSubmitAdd}
            placeholder="عنوان المهمة…"
            className="w-full rounded-field border border-accent bg-surface px-2 py-1 text-sm focus:outline-none"
          />
        </form>
      )}
      <div className="flex min-h-12 flex-col gap-1.5">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ task, onOpen }: { task: TaskRow; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpen(task.id)}
      className={clsx(isDragging && "opacity-40")}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task, overlay }: { task: TaskRow; overlay?: boolean }) {
  return (
    <div
      className={clsx(
        "cursor-grab rounded-[9px] border border-line bg-surface px-2.5 py-2 text-right",
        overlay && "rotate-1 ring-1 ring-saffron/40",
        task.priority === "urgent" && "border-r-[3px] border-r-saffron",
      )}
    >
      <div className="mb-1 line-clamp-2 text-[13px] font-semibold leading-snug">{task.title}</div>
      <div className="flex items-center justify-between gap-1.5">
        <PriorityChip priority={task.priority} />
        <span className="flex items-center gap-1">
          <DueBadge task={task} />
          {task.assignee && (
            <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={6} />
          )}
        </span>
      </div>
    </div>
  );
}
