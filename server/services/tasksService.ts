import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  tasks,
  taskActivity,
  taskWatchers,
  taskDependencies,
  notifications,
  userTaskSections,
  type Task,
  type User,
} from "../../shared/schema";
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
  actorId?: number,
) {
  const targets = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
  if (!targets.length) return;
  await db
    .insert(notifications)
    .values(targets.map((userId) => ({ userId, type, title, body, taskId, actorId: actorId ?? null })));
  broadcast({ type: "notifications" });
}

/** المسؤول + المتعاونون + المنشئ — جمهور إشعارات المهمة */
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
 * إكمال / إلغاء إكمال مهمة (نموذج أسانا).
 * إكمال الأم لا يُكمل الفرعية؛ عند الإكمال تُشعر الجمهور وتُنبّه
 * مسؤولي المهام التي كانت محجوبة بهذه المهمة.
 */
export async function setTaskCompletion(task: Task, completed: boolean, actor: User) {
  if (task.isCompleted === completed) return task;

  const [updated] = await db
    .update(tasks)
    .set({
      isCompleted: completed,
      completedAt: completed ? new Date() : null,
      completedById: completed ? actor.id : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id))
    .returning();

  await logActivity(task.id, actor.id, completed ? "completed" : "uncompleted");

  if (completed) {
    const audience = await taskAudience(updated);
    await notify(
      audience,
      "completed",
      `أكمل ${actor.name} مهمة: «${task.title}»`,
      null,
      task.id,
      actor.id,
      actor.id,
    );

    // انفتح الطريق للمهام المحجوبة بهذه المهمة
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
            undefined,
            actor.id,
          );
      }
    }
  }

  broadcast({ type: "tasks", taskId: task.id, projectId: updated.projectId ?? undefined });
  return updated;
}

/** أقسام «مهامي» للمستخدم — تُنشأ الافتراضية عند أول طلب */
export async function ensureMyTaskSections(userId: number) {
  const existing = await db
    .select()
    .from(userTaskSections)
    .where(eq(userTaskSections.userId, userId))
    .orderBy(userTaskSections.orderIndex);
  if (existing.length) return existing;

  const defaults = [
    { title: "المسندة حديثًا", isDefault: true },
    { title: "اليوم", isDefault: false },
    { title: "قادمة", isDefault: false },
    { title: "لاحقًا", isDefault: false },
  ];
  const rows = await db
    .insert(userTaskSections)
    .values(defaults.map((d, i) => ({ userId, title: d.title, orderIndex: i, isDefault: d.isDefault })))
    .returning();
  return rows;
}

export async function getTasksByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(tasks).where(inArray(tasks.id, ids));
}
