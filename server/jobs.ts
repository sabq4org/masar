import { and, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { tasks, statuses, notifications } from "../shared/schema";
import { notify } from "./services/tasksService";

/**
 * تذكيرات المواعيد — كل 15 دقيقة:
 * - «موعد قريب»: تستحق خلال 24 ساعة ولم يُرسل تذكير خلال آخر 20 ساعة
 * - «متأخرة»: تجاوزت الاستحقاق ولم يُرسل تذكير تأخر خلال آخر 24 ساعة
 */
async function sendDueReminders() {
  const allStatuses = await db.select().from(statuses);
  const openIds = allStatuses
    .filter((s) => s.category !== "done" && s.category !== "closed")
    .map((s) => s.id);
  if (!openIds.length) return;

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000);

  const candidates = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.isArchived, false),
        inArray(tasks.statusId, openIds),
        isNotNull(tasks.assigneeId),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, in24h),
      ),
    );

  for (const task of candidates) {
    if (!task.assigneeId || !task.dueAt) continue;
    const overdue = task.dueAt < now;
    const type = overdue ? "overdue" : "due_soon";
    const dedupHours = overdue ? 24 : 20;
    const since = new Date(now.getTime() - dedupHours * 3600_000);

    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.taskId, task.id),
          eq(notifications.userId, task.assigneeId),
          eq(notifications.type, type),
          gt(notifications.createdAt, since),
        ),
      )
      .limit(1);
    if (already) continue;

    const dueStr = task.dueAt.toLocaleString("ar-SA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    await notify(
      [task.assigneeId],
      type,
      overdue ? `متأخرة: «${task.title}»` : `تستحق قريبًا: «${task.title}»`,
      overdue ? `كان الاستحقاق ${dueStr}` : `الاستحقاق ${dueStr}`,
      task.id,
    );
  }
}

export function startJobs() {
  const run = () =>
    sendDueReminders().catch((e) => console.error("[masar] reminders error:", e));
  setTimeout(run, 30_000); // أول تشغيل بعد نصف دقيقة من الإقلاع
  setInterval(run, 15 * 60_000);
  console.log("مهام التذكير المجدولة تعمل (كل 15 دقيقة)");
}
