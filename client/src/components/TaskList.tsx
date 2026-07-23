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
import { ChevronDown, MessageSquare, MoreHorizontal, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import type { TaskRow } from "../lib/types";
import { api } from "../lib/api";
import { Avatar, CheckCircle, CollaboratorStack, MilestoneIcon, ProjectDot } from "./bits";
import { AssigneePicker, DueDatePicker, Popover, PriorityPicker } from "./pickers";
import { useTaskPane } from "../lib/taskPane";
import { useI18n } from "../lib/i18n";

export interface ListGroup {
  id: number | null;
  title: string;
  deletable?: boolean;
  renamable?: boolean;
}

interface TaskListProps {
  groups: ListGroup[];
  tasks: TaskRow[];
  groupOf: (t: TaskRow) => number | null;
  /** ترتيب المهمة داخل مجموعتها */
  orderOf: (t: TaskRow) => number;
  onReorder: (movedId: number, groupId: number | null, orderedIds: number[]) => void;
  onAddTask: (title: string, groupId: number | null) => void;
  onPatchTask: (taskId: number, fields: Record<string, unknown>) => void;
  onAddGroup?: (title: string) => void;
  onRenameGroup?: (groupId: number, title: string) => void;
  onDeleteGroup?: (groupId: number) => void;
  showProject?: boolean;
  showAssignee?: boolean;
}

/** عرض القائمة — جدول أسانا بأقسام قابلة للطي وتحرير مباشر وسحب وإفلات */
export default function TaskList(props: TaskListProps) {
  const { t } = useI18n();
  const { groups, tasks, groupOf, orderOf } = props;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
      else m.set(gid, [t]);
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
    let insertBeforeTaskId: number | null = null;
    const overStr = String(overId);
    if (overStr.startsWith("grp-")) {
      const raw = overStr.slice(4);
      targetGroup = raw === "null" ? null : Number(raw);
    } else if (overStr.startsWith("row-")) {
      const overTask = tasks.find((t) => t.id === Number(overStr.slice(4)));
      if (!overTask || overTask.id === moved.id) return;
      targetGroup = groupOf(overTask);
      insertBeforeTaskId = overTask.id;
    } else return;

    const list = (byGroup.get(targetGroup) ?? []).filter((t) => t.id !== moved.id);
    const ids = list.map((t) => t.id);
    const at = insertBeforeTaskId ? ids.indexOf(insertBeforeTaskId) : ids.length;
    ids.splice(at === -1 ? ids.length : at, 0, moved.id);
    props.onReorder(moved.id, targetGroup, ids);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragTask(tasks.find((t) => t.id === Number(e.active.id)) ?? null)}
      onDragEnd={onDragEnd}
    >
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {/* رأس الأعمدة */}
        <div className="flex h-8 items-center gap-2 border-b border-line bg-paper/70 pl-3 pr-9 text-[11px] font-bold text-ink-3">
          <span className="flex-1">{t("tasks.name")}</span>
          {props.showAssignee !== false && <span className="w-20 flex-none text-center">{t("tasks.assignee")}</span>}
          <span className="w-20 flex-none text-center">{t("tasks.dueColumn")}</span>
          <span className="w-20 flex-none text-center">{t("tasks.priority")}</span>
          {props.showProject && <span className="hidden w-32 flex-none sm:block">{t("tasks.project")}</span>}
        </div>

        {groups.map((g) => {
          const list = byGroup.get(g.id) ?? [];
          const gKey = String(g.id);
          const isCollapsed = collapsed.has(gKey);
          return (
            <SectionBlock
              key={gKey}
              {...props}
              t={t}
              group={g}
              sectionTasks={list}
              collapsed={isCollapsed}
              onToggle={() => {
                const next = new Set(collapsed);
                if (isCollapsed) next.delete(gKey);
                else next.add(gKey);
                setCollapsed(next);
              }}
            />
          );
        })}

        {props.onAddGroup && (
          <div className="border-t border-line-soft px-3 py-2">
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
                  onBlur={(e) => {
                    if (groupTitle.trim()) props.onAddGroup!(groupTitle.trim());
                    setGroupTitle("");
                    setAddingGroup(false);
                  }}
                  placeholder={t("tasks.sectionName")}
                  className="w-64 rounded-field border border-saffron bg-surface px-2.5 py-1 text-sm font-bold focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => setAddingGroup(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-ink-3 hover:text-saffron"
              >
                <Plus size={14} /> {t("tasks.addSection")}
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        {dragTask && (
          <div className="rounded-field border border-saffron/50 bg-surface px-3 py-1.5 text-sm font-semibold shadow-lg">
            {dragTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SectionBlock({
  group,
  sectionTasks,
  collapsed,
  onToggle,
  t,
  ...props
}: Omit<TaskListProps, "tasks"> & {
  group: ListGroup;
  sectionTasks: TaskRow[];
  collapsed: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const titleRef = useRef("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `grp-${group.id}` });

  const setTitleBoth = (v: string) => {
    titleRef.current = v;
    setTitle(v);
  };

  /** Enter ثم blur كان يضاعف الإنشاء — نقرأ من ref ونُصفّر فورًا */
  const submitAdd = (close: boolean) => {
    const t = titleRef.current.trim();
    setTitleBoth("");
    if (t) props.onAddTask(t, group.id);
    if (close) setAdding(false);
  };

  return (
    <div ref={setNodeRef} className={clsx(isOver && "bg-accent-soft/30")}>
      {/* رأس القسم */}
      <div className="group/sec flex h-9 items-center gap-1.5 border-t border-line-soft px-2 first:border-t-0">
        <button onClick={onToggle} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label={t("tasks.collapseSection")}>
          <ChevronDown size={14} className={clsx("transition-transform", collapsed && "-rotate-90")} />
        </button>
        {renaming && group.id != null ? (
          <input
            autoFocus
            defaultValue={group.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== group.title) props.onRenameGroup?.(group.id as number, v);
              setRenaming(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="rounded-field border border-saffron bg-surface px-2 py-0.5 text-sm font-bold focus:outline-none"
          />
        ) : (
          <button
            onDoubleClick={() => group.renamable && setRenaming(true)}
            className="text-sm font-bold"
            title={group.renamable ? t("tasks.dblClickRename") : undefined}
          >
            {group.title}
          </button>
        )}
        <span className="text-[11px] tabular-nums text-ink-3">{sectionTasks.length}</span>
        <div className="flex-1" />
        <button
          onClick={() => setAdding(true)}
          className="rounded p-1 text-ink-3/70 hover:text-saffron"
          title={t("tasks.addTaskTitle")}
        >
          <Plus size={14} />
        </button>
        {(group.renamable || group.deletable) && group.id != null && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded p-1 text-ink-3/70 hover:text-ink"
              title={t("tasks.sectionOptions")}
            >
              <MoreHorizontal size={14} />
            </button>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} align="end" className="w-44">
              {group.renamable && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-right text-xs font-semibold hover:bg-line-soft"
                >
                  {t("tasks.renameSection")}
                </button>
              )}
              {group.deletable && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (confirm(t("tasks.deleteSectionConfirm", { name: group.title }))) props.onDeleteGroup?.(group.id as number);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-right text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash2 size={12} /> {t("tasks.deleteSection")}
                </button>
              )}
            </Popover>
          </div>
        )}
      </div>

      {/* الصفوف */}
      {!collapsed && (
        <>
          {sectionTasks.map((task) => (
            <Row key={task.id} task={task} translate={t} {...props} />
          ))}
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAdd(false);
              }}
              className="flex h-9 items-center gap-2 border-t border-line-soft pl-3 pr-9"
            >
              <span className="h-[18px] w-[18px] flex-none rounded-chip border border-dashed border-ink-3/40" />
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitleBoth(e.target.value)}
                onBlur={() => submitAdd(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setTitleBoth("");
                    setAdding(false);
                  }
                }}
                placeholder={t("tasks.writeTitle")}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex h-8 w-full items-center gap-2 border-t border-line-soft pr-9 text-xs font-semibold text-ink-3 hover:bg-line-soft/40 hover:text-saffron"
            >
              <Plus size={13} /> {t("tasks.add")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  task,
  translate: t,
  ...props
}: Omit<TaskListProps, "tasks"> & { task: TaskRow; translate: ReturnType<typeof useI18n>["t"] }) {
  const pane = useTaskPane();
  const drag = useDraggable({ id: task.id });
  const drop = useDroppable({ id: `row-${task.id}` });
  const subDone = (task.subtasks ?? []).filter((s) => s.isCompleted).length;
  const subTotal = (task.subtasks ?? []).length;

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.attributes}
      {...drag.listeners}
      onClick={() => pane.open(task.id)}
      className={clsx(
        "group/row flex h-9 cursor-pointer items-center gap-2 border-t border-line-soft pl-3 pr-3 text-sm hover:bg-line-soft/40",
        drag.isDragging && "opacity-30",
        drop.isOver && "shadow-[inset_0_2px_0_var(--masar-saffron)]",
      )}
    >
      <span className="w-3 flex-none" />
      {task.taskType === "milestone" ? (
        <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">
          <MilestoneIcon />
        </span>
      ) : (
        <CheckCircle
          checked={task.isCompleted}
          onToggle={(next) => props.onPatchTask(task.id, { isCompleted: next })}
        />
      )}
      <input
        key={task.title}
        defaultValue={task.title}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== task.title) props.onPatchTask(task.id, { title: v });
          else e.target.value = task.title;
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={clsx(
          "min-w-0 flex-1 cursor-text truncate rounded border border-transparent bg-transparent px-1 font-semibold hover:border-line-soft focus:border-saffron focus:outline-none",
          task.isCompleted && "text-ink-3",
        )}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          pane.open(task.id);
        }}
        className="hidden flex-none items-center gap-1 rounded-field border border-line px-1.5 py-0.5 text-[10px] font-bold text-ink-3 hover:border-saffron hover:text-saffron group-hover/row:flex"
        title={t("tasks.details")}
      >
        <PanelLeftOpen size={11} /> {t("tasks.details")}
      </button>
      {subTotal > 0 && (
        <span className="hidden flex-none items-center gap-0.5 text-[10px] tabular-nums text-ink-3 sm:flex">
          <MessageSquare size={10} className="rotate-180" />
          {subDone}/{subTotal}
        </span>
      )}
      <CollaboratorStack people={(task.watchers ?? []).map((w) => w.user)} max={3} size={5} />
      {props.showAssignee !== false && (
        <span className="flex w-20 flex-none items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <AssigneePicker
            compact
            value={task.assignee ?? null}
            onChange={(userId) => props.onPatchTask(task.id, { assigneeId: userId })}
          />
        </span>
      )}
      <span className="flex w-20 flex-none items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <DueDatePicker
          compact
          value={task.dueAt}
          isCompleted={task.isCompleted}
          onChange={(iso) => props.onPatchTask(task.id, { dueAt: iso })}
        />
      </span>
      <span className="flex w-20 flex-none items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <PriorityPicker
          value={task.priority}
          onChange={(p) => props.onPatchTask(task.id, { priority: p })}
        />
      </span>
      {props.showProject && (
        <span className="hidden w-32 flex-none items-center gap-1.5 truncate text-xs text-ink-2 sm:flex">
          {task.project && (
            <>
              <ProjectDot color={task.project.color} />
              <span className="truncate">{task.project.name}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
