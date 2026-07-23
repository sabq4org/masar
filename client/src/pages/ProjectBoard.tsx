import { useState } from "react";
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
import { Plus, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import clsx from "clsx";
import { api, queryClient } from "../lib/api";
import type { ProjectRow, StatusRow, TaskRow } from "../lib/types";
import { Avatar, DueBadge, PriorityChip } from "../components/bits";
import TaskSheet from "../components/TaskSheet";

export default function ProjectBoard({ id }: { id: number }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragTask, setDragTask] = useState<TaskRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { data: project } = useQuery<ProjectRow | null>({ queryKey: [`/api/projects/${id}`] });
  const { data: statusesData } = useQuery<StatusRow[] | null>({ queryKey: ["/api/statuses"] });
  const tasksKey = `/api/tasks?projectId=${id}&roots=1`;
  const { data: tasksData } = useQuery<TaskRow[] | null>({ queryKey: [tasksKey] });

  const statuses = Array.isArray(statusesData) ? statusesData : [];
  const tasks = Array.isArray(tasksData) ? tasksData : [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const changeStatus = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: number; statusId: number }) =>
      api("POST", `/api/tasks/${taskId}/status`, { statusId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [tasksKey] }),
    onError: (e: Error) => {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
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
    onError: (e: Error) => {
      setError(e.message);
      setTimeout(() => setError(null), 4000);
    },
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

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/projects" className="text-ink-3 hover:text-accent">
          <ArrowRight size={20} />
        </Link>
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: project?.color }} />
        <h1 className="text-2xl font-extrabold">{project?.name ?? "…"}</h1>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragTask(tasks.find((t) => t.id === Number(e.active.id)) ?? null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
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

      {openId && <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Column({
  status,
  tasks,
  onOpen,
  adding,
  newTitle,
  setNewTitle,
  onStartAdd,
  onSubmitAdd,
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
        "flex w-64 flex-none flex-col rounded-xl border bg-white/70 p-2",
        isOver ? "border-accent bg-accent-soft/60" : "border-line",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
        <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
        <span className="flex-1 text-sm font-bold" style={{ color: status.color }}>
          {status.nameAr}
        </span>
        <span className="text-xs tabular-nums text-ink-3">{tasks.length}</span>
        <button onClick={onStartAdd} className="text-ink-3 hover:text-accent" title="إضافة">
          <Plus size={15} />
        </button>
      </div>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitAdd();
          }}
          className="mb-2"
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={onSubmitAdd}
            placeholder="عنوان المهمة…"
            className="w-full rounded-lg border border-accent px-2 py-1.5 text-sm focus:outline-none"
          />
        </form>
      )}
      <div className="flex min-h-16 flex-col gap-2">
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
        "cursor-grab rounded-lg border border-line bg-white p-2.5 text-right shadow-sm",
        overlay && "rotate-2 shadow-lg",
        task.priority === "urgent" && "border-r-4 border-r-red-500",
      )}
    >
      <div className="mb-1.5 text-sm font-semibold leading-snug">{task.title}</div>
      <div className="flex items-center justify-between gap-2">
        <PriorityChip priority={task.priority} />
        <span className="flex items-center gap-1.5">
          <DueBadge task={task} />
          {task.assignee && (
            <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={6} />
          )}
        </span>
      </div>
    </div>
  );
}
