import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  tasks,
  taskActivity,
  taskWatchers,
  taskDependencies,
  notifications,
  statuses,
  statusTransitions,
  type Task,
  type User,
} from "../../shared/schema";
import { isTransitionAllowed } from "../../shared/statusRules";
import { broadcast } from "./events";

export async function logActivity(
  taskId: number,
  userId: number | null,
  action: string,
  detail?: unknown,
) {
  await db.insert(taskActivity).values({ taskId, userId, action, detail: detail ?? null });
}

export async function notify(
  userIds: number[],
  type: string,
  title: string,
  body: string | null,
  taskId: number | null,
  excludeUserId?: number,
) {
  const targets = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
  if (!targets.length) return;
  await db
    .insert(notifications)
    .values(targets.map((userId) => ({ userId, type, title, body, taskId })));
  broadcast({ type: "notifications" });
}

/** المسؤول + المشاركون — جمهور إشعارات المهمة */
export async function taskAudience(task: Task): Promise<number[]> {
  const watchers = await db
    .select({ userId: taskWatchers.userId })
    .from(taskWatchers)
    .where(eq(taskWatchers.taskId, task.id));
  const ids = watchers.map((w) => w.userId);
  if (task.assigneeId) ids.push(task.assigneeId);
  if (task.createdById) ids.push(task.createdById);
  return [...new Set(ids)];
}

/**
 * تغيير حالة مهمة مع فرض مصفوفة الانتقالات.
 * الانتقال إلى فئة closed (مؤجلة/ملغاة) مسموح من أي حالة،
 * والخروج من closed مسموح إلى أي حالة غير مغلقة.
 */
export async function changeStatus(task: Task, toStatusId: number, actor: User) {
  const [from] = await db.select().from(statuses).where(eq(statuses.id, task.statusId));
  const [to] = await db.select().from(statuses).where(eq(statuses.id, toStatusId));
  if (!to) throw Object.assign(new Error("الحالة غير موجودة"), { status: 400 });
  if (from.id === to.id) return task;

  const [allowed] = await db
    .select()
    .from(statusTransitions)
    .where(
      and(
        eq(statusTransitions.fromStatusId, from.id),
        eq(statusTransitions.toStatusId, to.id),
      ),
    );
  if (!isTransitionAllowed(from.category, to.category, Boolean(allowed)))
    throw Object.assign(
      new Error(`الانتقال من «${from.nameAr}» إلى «${to.nameAr}» غير مسموح`),
      { status: 422 },
    );

  const done = to.category === "done";
  const [updated] = await db
    .update(tasks)
    .set({
      statusId: to.id,
      completedAt: done ? new Date() : null,
      progress: done ? 100 : task.progress,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id))
    .returning();

  await logActivity(task.id, actor.id, "status_changed", {
    from: from.nameAr,
    to: to.nameAr,
  });
  const audience = await taskAudience(updated);
  await notify(
    audience,
    "status_change",
    `تغيّرت حالة «${task.title}»`,
    `من ${from.nameAr} إلى ${to.nameAr} بواسطة ${actor.name}`,
    task.id,
    actor.id,
  );

  // اكتمال مهمة حاجبة → أشعر مسؤولي المهام المحجوبة بها
  if (done || to.category === "closed") {
    const dependents = await db
      .select({ taskId: taskDependencies.taskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.blockedByTaskId, task.id));
    if (dependents.length) {
      const blockedTasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, dependents.map((d) => d.taskId)));
      for (const bt of blockedTasks) {
        if (bt.assigneeId)
          await notify(
            [bt.assigneeId],
            "blocker_done",
            `انفتح الطريق لمهمتك «${bt.title}»`,
            `اكتملت المهمة الحاجبة: «${task.title}»`,
            bt.id,
          );
      }
    }
  }

  broadcast({ type: "tasks", taskId: task.id, projectId: updated.projectId ?? undefined });
  return updated;
}

export async function allowedNextStatuses(statusId: number) {
  const [current] = await db.select().from(statuses).where(eq(statuses.id, statusId));
  if (!current) return [];
  const all = await db.select().from(statuses).orderBy(statuses.orderIndex);
  if (current.category === "closed")
    return all.filter((s) => s.category !== "closed" || s.id === current.id);
  const rows = await db
    .select({ toId: statusTransitions.toStatusId })
    .from(statusTransitions)
    .where(eq(statusTransitions.fromStatusId, statusId));
  const allowedIds = new Set(rows.map((r) => r.toId));
  return all.filter(
    (s) => s.id === current.id || allowedIds.has(s.id) || s.category === "closed",
  );
}

export async function getTasksByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(tasks).where(inArray(tasks.id, ids));
}
