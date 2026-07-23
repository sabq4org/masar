import { useMemo, useRef, useState } from "react";
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
import clsx from "clsx";
import { Plus, ThumbsUp } from "lucide-react";
import type { TaskRow } from "../lib/types";
import { Avatar, CheckCircle, DueText, MilestoneIcon, PriorityPill } from "./bits";
import type { ListGroup } from "./TaskList";
import { useTaskPane } from "../lib/taskPane";

interface TaskBoardProps {
  groups: ListGroup[];
  tasks: TaskRow[];
  groupOf: (t: TaskRow) => number | null;
  orderOf: (t: TaskRow) => number;
  onReorder: (movedId: number, groupId: number | null, orderedIds: number[]) => void;
  onAddTask: (title: string, groupId: number | null) => void;
  onPatchTask: (taskId: number, fields: Record<string, unknown>) => void;
  onAddGroup?: (title: string) => void;
}

/** عرض اللوحة — أعمدة الأقسام بأسلوب أسانا */
export default function TaskBoard(props: TaskBoardProps) {
  const { groups, tasks, groupOf, orderOf } = props;
  const [dragTask, setDragTask] = useState<TaskRow | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byGroup = useMemo(() => {
    const m = new Map<number | null, TaskRow[]>();
    for (const g of groups) m.set(g.id, []);
    for (const t of tasks) {
      const gid = groupOf(t);
      const bucket = m.get(gid) ?? m.get(null);
      if (bucket) bucket.push(t);
    }
    for (const list of m.values()) list.sort((a, b) => orderOf(a) - orderOf(b));
    return m;
  }, [groups, tasks, groupOf, orderOf]);

  function onDragEnd(e: DragEndEvent) {
    setDragTask(null);
    const moved = tasks.find((t) => t.id === Number(e.active.id));
    const overId = e.over?.id;
    if (!moved || overId == null) return;
    let targetGroup: number | null;
    let insertBefore: number | null = null;
    const s = String(overId);
    if (s.startsWith("col-")) {
      const raw = s.slice(4);
      targetGroup = raw === "null" ? null : Number(raw);
    } else if (s.startsWith("card-")) {
      const overTask = tasks.find((t) => t.id === Number(s.slice(5)));
      if (!overTask || overTask.id === moved.id) return;
      targetGroup = groupOf(overTask);
      insertBefore = overTask.id;
    } else return;

    const ids = (byGroup.get(targetGroup) ?? []).filter((t) => t.id !== moved.id).map((t) => t.id);
    const at = insertBefore ? ids.indexOf(insertBefore) : ids.length;
    ids.splice(at === -1 ? ids.length : at, 0, moved.id);
    props.onReorder(moved.id, targetGroup, ids);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragTask(tasks.find((t) => t.id === Number(e.active.id)) ?? null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {groups.map((g) => (
          <Column key={String(g.id)} {...props} group={g} columnTasks={byGroup.get(g.id) ?? []} />
        ))}
        {props.onAddGroup && (
          <div className="w-64 flex-none">
            {addingGroup ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (groupTitle.trim()) props.onAddGroup!(groupTitle.trim());
                  setGroupTitle("");
                  setAddingGroup(false);
                }}
              >
                <input
                  autoFocus
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  onBlur={() => {
                    if (groupTitle.trim()) props.onAddGroup!(groupTitle.trim());
                    setGroupTitle("");
                    setAddingGroup(false);
                  }}
                  placeholder="اسم القسم…"
                  className="w-full rounded-field border border-saffron bg-surface px-2.5 py-1.5 text-sm font-bold focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => setAddingGroup(true)}
                className="flex w-full items-center gap-1.5 rounded-field border border-dashed border-line px-3 py-2 text-xs font-bold text-ink-3 hover:border-saffron hover:text-saffron"
              >
                <Plus size={14} /> إضافة قسم
              </button>
            )}
          </div>
        )}
      </div>
      <DragOverlay>{dragTask && <Card task={dragTask} overlay onPatch={() => {}} />}</DragOverlay>
    </DndContext>
  );
}

function Column({
  group,
  columnTasks,
  ...props
}: Omit<TaskBoardProps, "tasks"> & { group: ListGroup; columnTasks: TaskRow[] }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const titleRef = useRef("");
  const { setNodeRef, isOver } = useDroppable({ id: `col-${group.id}` });

  const setTitleBoth = (v: string) => {
    titleRef.current = v;
    setTitle(v);
  };

  const submit = (close: boolean) => {
    const t = titleRef.current.trim();
    setTitleBoth("");
    if (t) props.onAddTask(t, group.id);
    if (close) setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex max-h-[calc(100dvh-14rem)] w-72 flex-none flex-col rounded-card border bg-paper/60 p-2",
        isOver ? "border-saffron bg-accent-soft/40" : "border-line",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className="flex-1 truncate text-sm font-bold">{group.title}</span>
        <span className="text-[11px] tabular-nums text-ink-3">{columnTasks.length}</span>
        <button onClick={() => setAdding(true)} className="rounded p-0.5 text-ink-3 hover:text-saffron" title="إضافة مهمة">
          <Plus size={14} />
        </button>
      </div>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          className="mb-2"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitleBoth(e.target.value)}
            onBlur={() => submit(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTitleBoth("");
                setAdding(false);
              }
            }}
            placeholder="اسم المهمة…"
            className="w-full rounded-field border border-saffron bg-surface px-2.5 py-1.5 text-sm focus:outline-none"
          />
        </form>
      )}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {columnTasks.map((t) => (
          <DraggableCard key={t.id} task={t} onPatch={props.onPatchTask} />
        ))}
        {!columnTasks.length && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-field border border-dashed border-line py-4 text-center text-xs text-ink-3 hover:border-saffron hover:text-saffron"
          >
            + إضافة مهمة
          </button>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  onPatch,
}: {
  task: TaskRow;
  onPatch: (id: number, fields: Record<string, unknown>) => void;
}) {
  const pane = useTaskPane();
  const drag = useDraggable({ id: task.id });
  const drop = useDroppable({ id: `card-${task.id}` });
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.attributes}
      {...drag.listeners}
      onClick={() => !drag.isDragging && pane.open(task.id)}
      className={clsx(
        drag.isDragging && "opacity-30",
        drop.isOver && "shadow-[0_-2px_0_var(--masar-saffron)]",
      )}
    >
      <Card task={task} onPatch={onPatch} />
    </div>
  );
}

function Card({
  task,
  overlay,
  onPatch,
}: {
  task: TaskRow;
  overlay?: boolean;
  onPatch: (id: number, fields: Record<string, unknown>) => void;
}) {
  const subTotal = (task.subtasks ?? []).length;
  const subDone = (task.subtasks ?? []).filter((s) => s.isCompleted).length;
  return (
    <div
      className={clsx(
        "cursor-grab rounded-[10px] border border-line bg-surface px-3 py-2.5 text-right shadow-card",
        overlay && "rotate-1 ring-1 ring-saffron/40",
      )}
    >
      <div className="mb-1.5 flex items-start gap-2">
        {task.taskType === "milestone" ? (
          <span className="mt-0.5"><MilestoneIcon /></span>
        ) : (
          <CheckCircle
            checked={task.isCompleted}
            size={16}
            onToggle={(next) => onPatch(task.id, { isCompleted: next })}
          />
        )}
        <span
          className={clsx(
            "min-w-0 flex-1 text-[13px] font-semibold leading-snug",
            task.isCompleted && "text-ink-3",
          )}
        >
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-2 pr-6">
        <PriorityPill priority={task.priority} size="xs" />
        <DueText task={task} />
        {subTotal > 0 && (
          <span className="text-[10px] tabular-nums text-ink-3">{subDone}/{subTotal} فرعية</span>
        )}
        <span className="flex-1" />
        {task.assignee && <Avatar name={task.assignee.name} color={task.assignee.avatarColor} src={task.assignee.avatarUrl} size={6} />}
      </div>
    </div>
  );
}
