import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  tasks,
  taskComments,
  taskWatchers,
  taskActivity,
  taskDependencies,
  taskLikes,
  commentLikes,
  attachments,
} from "../../shared/schema";
import { broadcast } from "../services/events";
import { requireAuth, requirePermission, getSessionUser } from "../auth";
import { PERMISSIONS, roleHas } from "../permissions";
import {
  setTaskCompletion,
  logActivity,
  notify,
  taskAudience,
} from "../services/tasksService";

const taskInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable().optional(),
  taskType: z.enum(["task", "milestone", "approval"]).optional(),
  assigneeId: z.number().int().nullable().optional(),
  departmentId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  sectionId: z.number().int().nullable().optional(),
  myTasksSectionId: z.number().int().nullable().optional(),
  myTasksOrderIndex: z.number().int().optional(),
  parentTaskId: z.number().int().nullable().optional(),
  startAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  linkUrl: z.string().url().max(1000).nullable().optional(),
});

const taskCard = {
  assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
  project: { columns: { id: true, name: true, color: true } },
  section: { columns: { id: true, title: true } },
  watchers: {
    columns: { userId: true },
    with: { user: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
    limit: 6,
  },
} as const;

export function registerTaskRoutes(app: Express) {
  // ─── قائمة المهام بفلاتر ───
  app.get("/api/tasks", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });

    const q = req.query;
    const filters: SQL[] = [eq(tasks.isArchived, q.archived === "1")];

    const canViewAll = roleHas(user.role, PERMISSIONS.VIEW_ALL);
    if (!canViewAll || q.mine === "1") {
      filters.push(
        or(eq(tasks.assigneeId, user.id), eq(tasks.createdById, user.id))!,
      );
    }
    if (q.projectId) filters.push(eq(tasks.projectId, Number(q.projectId)));
    if (q.sectionId) filters.push(eq(tasks.sectionId, Number(q.sectionId)));
    if (q.assigneeId) filters.push(eq(tasks.assigneeId, Number(q.assigneeId)));
    if (q.departmentId) filters.push(eq(tasks.departmentId, Number(q.departmentId)));
    if (q.parentId) filters.push(eq(tasks.parentTaskId, Number(q.parentId)));
    else if (q.roots === "1") filters.push(isNull(tasks.parentTaskId));
    // completed=0 غير المكتملة فقط | completed=1 المكتملة فقط | غير ذلك: الكل
    if (q.completed === "0") filters.push(eq(tasks.isCompleted, false));
    if (q.completed === "1") filters.push(eq(tasks.isCompleted, true));
    if (typeof q.q === "string" && q.q.trim())
      filters.push(ilike(tasks.title, `%${q.q.trim()}%`));

    const limit = Math.min(Number(q.limit) || 500, 1000);
    const list = await db.query.tasks.findMany({
      where: and(...filters),
      with: {
        ...taskCard,
        subtasks: { columns: { id: true, isCompleted: true } },
      },
      orderBy: [asc(tasks.orderIndex), desc(tasks.createdAt)],
      limit,
    });
    res.json(list);
  });

  // ─── إعادة ترتيب دفعة واحدة (سحب وإفلات) ───
  app.post("/api/tasks/reorder", requireAuth, async (req, res) => {
    const parsed = z
      .object({
        items: z
          .array(
            z.object({
              id: z.number().int(),
              sectionId: z.number().int().nullable().optional(),
              orderIndex: z.number().int().optional(),
              myTasksSectionId: z.number().int().nullable().optional(),
              myTasksOrderIndex: z.number().int().optional(),
            }),
          )
          .min(1)
          .max(300),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

    for (const item of parsed.data.items) {
      const { id, ...fields } = item;
      if (!Object.keys(fields).length) continue;
      await db.update(tasks).set({ ...fields, updatedAt: new Date() }).where(eq(tasks.id, id));
    }
    broadcast({ type: "tasks" });
    res.json({ ok: true });
  });

  // ─── إنشاء مهمة ───
  app.post("/api/tasks", requirePermission(PERMISSIONS.CREATE), async (req, res) => {
    const parsed = taskInput.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "بيانات غير صالحة", detail: parsed.error.flatten() });
    const user = (req as any).user;

    // المهمة الجديدة تسبق غيرها في قسمها (مثل أسانا: أعلى القسم عند الإضافة السريعة أسفل القائمة عند صف الإضافة — نستخدم آخر ترتيب)
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tasks.orderIndex}), -1)` })
      .from(tasks)
      .where(
        and(
          parsed.data.projectId
            ? eq(tasks.projectId, parsed.data.projectId)
            : isNull(tasks.projectId),
          parsed.data.sectionId
            ? eq(tasks.sectionId, parsed.data.sectionId)
            : isNull(tasks.sectionId),
        ),
      );

    const [task] = await db
      .insert(tasks)
      .values({
        ...parsed.data,
        approvalStatus: parsed.data.taskType === "approval" ? "pending" : null,
        tags: parsed.data.tags ?? [],
        createdById: user.id,
        departmentId: parsed.data.departmentId ?? user.departmentId,
        orderIndex: Number(maxOrder) + 1,
      })
      .returning();

    await logActivity(task.id, user.id, "created", { title: task.title });
    if (task.assigneeId && task.assigneeId !== user.id) {
      await notify(
        [task.assigneeId],
        "assigned",
        `أسند إليك ${user.name} مهمة: «${task.title}»`,
        null,
        task.id,
        undefined,
        user.id,
      );
      await logActivity(task.id, user.id, "assigned", { assigneeId: task.assigneeId });
    }
    broadcast({ type: "tasks", taskId: task.id, projectId: task.projectId ?? undefined });
    res.status(201).json(task);
  });

  // ─── تفاصيل مهمة ───
  app.get("/api/tasks/:id", requireAuth, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(); // يمرر مثل /api/tasks/export.csv لمساره
    const user = await getSessionUser(req);
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        createdBy: { columns: { id: true, name: true } },
        completedBy: { columns: { id: true, name: true } },
        project: { columns: { id: true, name: true, color: true } },
        section: { columns: { id: true, title: true } },
        parent: { columns: { id: true, title: true } },
        subtasks: {
          with: { assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
          orderBy: [asc(tasks.orderIndex), asc(tasks.createdAt)],
        },
        comments: {
          with: {
            user: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
            likes: { columns: { userId: true } },
          },
          orderBy: [asc(taskComments.createdAt)],
        },
        watchers: { with: { user: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } } } },
        likes: { with: { user: { columns: { id: true, name: true } } } },
        attachments: { orderBy: [desc(attachments.createdAt)] },
        activity: {
          with: { user: { columns: { id: true, name: true } } },
          orderBy: [desc(taskActivity.createdAt)],
          limit: 50,
        },
      },
    });
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

    // العوائق: مهام تحجب هذه المهمة
    const blockerRows = await db
      .select({
        id: taskDependencies.id,
        blockedByTaskId: taskDependencies.blockedByTaskId,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, id));
    const blockerTasks = blockerRows.length
      ? await db.query.tasks.findMany({
          where: or(...blockerRows.map((b) => eq(tasks.id, b.blockedByTaskId)))!,
          columns: { id: true, title: true, isCompleted: true },
        })
      : [];
    const dependencies = blockerRows.map((b) => ({
      ...b,
      task: blockerTasks.find((t) => t.id === b.blockedByTaskId) ?? null,
    }));

    res.json({
      ...task,
      dependencies,
      likedByMe: user ? task.likes.some((l: any) => l.userId === user.id) : false,
    });
  });

  // ─── تعديل مهمة ───
  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

    const isOwn = task.assigneeId === user.id || task.createdById === user.id;
    if (!roleHas(user.role, PERMISSIONS.EDIT_ANY) && !(isOwn && roleHas(user.role, PERMISSIONS.EDIT_OWN)))
      return res.status(403).json({ error: "لا تملك صلاحية تعديل هذه المهمة" });

    const parsed = taskInput
      .partial()
      .extend({
        isCompleted: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        orderIndex: z.number().int().optional(),
        myTasksSectionId: z.number().int().nullable().optional(),
        myTasksOrderIndex: z.number().int().optional(),
        approvalStatus: z
          .enum(["pending", "approved", "changes_requested", "rejected"])
          .nullable()
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const { isCompleted, ...fields } = parsed.data;

    // تغيير المسؤول يعيد المهمة إلى قسم «المسندة حديثًا» عند المسؤول الجديد
    if (
      fields.assigneeId !== undefined &&
      fields.assigneeId !== task.assigneeId &&
      fields.myTasksSectionId === undefined
    ) {
      (fields as any).myTasksSectionId = null;
      (fields as any).myTasksOrderIndex = 0;
    }
    // تحويل النوع إلى اعتماد يفعّل حالة «معلّق»
    if (fields.taskType === "approval" && task.taskType !== "approval" && !fields.approvalStatus)
      (fields as any).approvalStatus = "pending";
    if (fields.taskType && fields.taskType !== "approval" && task.taskType === "approval")
      (fields as any).approvalStatus = null;

    const prevAssignee = task.assigneeId;
    let updated = task;
    if (Object.keys(fields).length) {
      [updated] = await db
        .update(tasks)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();

      const loggable = Object.keys(fields).filter(
        (f) => !["orderIndex", "myTasksSectionId", "myTasksOrderIndex"].includes(f),
      );
      if (loggable.length) await logActivity(id, user.id, "updated", { fields: loggable });

      if (fields.assigneeId !== undefined && fields.assigneeId !== prevAssignee && fields.assigneeId) {
        await notify(
          [fields.assigneeId],
          "assigned",
          `أسند إليك ${user.name} مهمة: «${updated.title}»`,
          null,
          id,
          undefined,
          user.id,
        );
        await logActivity(id, user.id, "assigned", { assigneeId: fields.assigneeId });
      }
      if (fields.dueAt !== undefined)
        await logActivity(id, user.id, "due_changed", { dueAt: fields.dueAt });
    }

    if (isCompleted !== undefined) updated = await setTaskCompletion(updated, isCompleted, user);

    broadcast({ type: "tasks", taskId: id, projectId: updated.projectId ?? undefined });
    res.json(updated);
  });

  // ─── حذف مهمة (مثل أسانا) ───
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    const isOwn = task.assigneeId === user.id || task.createdById === user.id;
    if (!roleHas(user.role, PERMISSIONS.DELETE) && !isOwn)
      return res.status(403).json({ error: "لا تملك صلاحية حذف هذه المهمة" });
    // فك ارتباط المهام الفرعية أولًا ثم الحذف
    await db.update(tasks).set({ parentTaskId: null }).where(eq(tasks.parentTaskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    broadcast({ type: "tasks", projectId: task.projectId ?? undefined });
    res.json({ ok: true });
  });

  // ─── نسخ مهمة ───
  app.post("/api/tasks/:id/duplicate", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    const { id: _id, createdAt, updatedAt, completedAt, completedById, ...rest } = task;
    const [copy] = await db
      .insert(tasks)
      .values({
        ...rest,
        title: `${task.title} (نسخة)`,
        isCompleted: false,
        createdById: user.id,
      })
      .returning();
    await logActivity(copy.id, user.id, "created", { duplicatedFrom: id });
    broadcast({ type: "tasks", projectId: task.projectId ?? undefined });
    res.status(201).json(copy);
  });

  // ─── قرار الاعتماد (مهمة من نوع اعتماد) ───
  app.post("/api/tasks/:id/approval", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({ decision: z.enum(["approved", "changes_requested", "rejected"]) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    if (task.taskType !== "approval")
      return res.status(422).json({ error: "هذه المهمة ليست مهمة اعتماد" });

    const LABELS: Record<string, string> = {
      approved: "اعتمد",
      changes_requested: "طلب تعديلات على",
      rejected: "رفض",
    };
    // الاعتماد يُكمل المهمة؛ طلب التعديل لا يغلقها (قرار معماري أصلي محفوظ)
    const completes = parsed.data.decision === "approved" || parsed.data.decision === "rejected";
    let [updated] = await db
      .update(tasks)
      .set({ approvalStatus: parsed.data.decision, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    await logActivity(id, user.id, "approval_decided", { decision: parsed.data.decision });
    if (completes) updated = await setTaskCompletion(updated, true, user);

    const audience = await taskAudience(updated);
    await notify(
      audience,
      "approval_decision",
      `${LABELS[parsed.data.decision]} ${user.name}: «${task.title}»`,
      null,
      id,
      user.id,
      user.id,
    );
    broadcast({ type: "tasks", taskId: id, projectId: task.projectId ?? undefined });
    res.json(updated);
  });

  // ─── المهام الفرعية: مهام كاملة بأم (نموذج أسانا) ───
  app.post("/api/tasks/:id/subtasks", requireAuth, async (req, res) => {
    const parentId = Number(req.params.id);
    const parsed = z.object({ title: z.string().min(1).max(300) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const [parent] = await db.select().from(tasks).where(eq(tasks.id, parentId));
    if (!parent) return res.status(404).json({ error: "المهمة غير موجودة" });

    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tasks.orderIndex}), -1)` })
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentId));

    const [row] = await db
      .insert(tasks)
      .values({
        title: parsed.data.title,
        parentTaskId: parentId,
        projectId: parent.projectId,
        departmentId: parent.departmentId,
        createdById: user.id,
        orderIndex: Number(maxOrder) + 1,
      })
      .returning();
    await logActivity(parentId, user.id, "subtask_added", { title: row.title });
    broadcast({ type: "tasks", taskId: parentId });
    res.status(201).json(row);
  });

  // ─── الإعجاب بالمهمة ───
  app.post("/api/tasks/:id/like", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    const [inserted] = await db
      .insert(taskLikes)
      .values({ taskId, userId: user.id })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      await logActivity(taskId, user.id, "liked");
      if (task.assigneeId && task.assigneeId !== user.id)
        await notify(
          [task.assigneeId],
          "like",
          `أُعجب ${user.name} بمهمتك «${task.title}»`,
          null,
          taskId,
          user.id,
          user.id,
        );
    }
    broadcast({ type: "tasks", taskId });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/tasks/:id/like", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .delete(taskLikes)
      .where(and(eq(taskLikes.taskId, Number(req.params.id)), eq(taskLikes.userId, user.id)));
    broadcast({ type: "tasks", taskId: Number(req.params.id) });
    res.json({ ok: true });
  });

  // ─── التعليقات ───
  app.post("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({
        content: z.string().min(1).max(10000),
        mentions: z.array(z.number().int()).max(20).default([]),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

    const [comment] = await db
      .insert(taskComments)
      .values({ taskId, userId: user.id, ...parsed.data })
      .returning();

    // المعلّق ينضم للمتعاونين تلقائيًا (سلوك أسانا)
    await db
      .insert(taskWatchers)
      .values({ taskId, userId: user.id })
      .onConflictDoNothing();

    const audience = await taskAudience(task);
    await notify(
      audience,
      "comment",
      `علّق ${user.name} على «${task.title}»`,
      parsed.data.content.slice(0, 140),
      taskId,
      user.id,
      user.id,
    );
    if (parsed.data.mentions.length)
      await notify(
        parsed.data.mentions,
        "mention",
        `ذكرك ${user.name} في «${task.title}»`,
        parsed.data.content.slice(0, 140),
        taskId,
        user.id,
        user.id,
      );
    broadcast({ type: "tasks", taskId });
    res.status(201).json(comment);
  });

  // ─── الإعجاب بتعليق ───
  app.post("/api/comments/:id/like", requireAuth, async (req, res) => {
    const commentId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .insert(commentLikes)
      .values({ commentId, userId: user.id })
      .onConflictDoNothing();
    const [comment] = await db.select().from(taskComments).where(eq(taskComments.id, commentId));
    if (comment) broadcast({ type: "tasks", taskId: comment.taskId });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/comments/:id/like", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .delete(commentLikes)
      .where(
        and(eq(commentLikes.commentId, Number(req.params.id)), eq(commentLikes.userId, user.id)),
      );
    res.json({ ok: true });
  });

  // ─── المتعاونون ───
  app.post("/api/tasks/:id/watchers", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    await db
      .insert(taskWatchers)
      .values({ taskId, userId: parsed.data.userId })
      .onConflictDoNothing();
    broadcast({ type: "tasks", taskId });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/tasks/:id/watchers/:userId", requireAuth, async (req, res) => {
    await db
      .delete(taskWatchers)
      .where(
        and(
          eq(taskWatchers.taskId, Number(req.params.id)),
          eq(taskWatchers.userId, Number(req.params.userId)),
        ),
      );
    broadcast({ type: "tasks", taskId: Number(req.params.id) });
    res.json({ ok: true });
  });

  // ─── الاعتماديات ───
  app.post("/api/tasks/:id/dependencies", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const user = await getSessionUser(req);
    const parsed = z.object({ blockedByTaskId: z.number().int() }).safeParse(req.body);
    if (!parsed.success || parsed.data.blockedByTaskId === taskId)
      return res.status(400).json({ error: "بيانات غير صالحة" });
    const [reverse] = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, parsed.data.blockedByTaskId),
          eq(taskDependencies.blockedByTaskId, taskId),
        ),
      );
    if (reverse) return res.status(422).json({ error: "هذا يُنشئ حلقة اعتماد دائرية" });
    await db
      .insert(taskDependencies)
      .values({ taskId, blockedByTaskId: parsed.data.blockedByTaskId })
      .onConflictDoNothing();
    await logActivity(taskId, user?.id ?? null, "dependency_added", {
      blockedBy: parsed.data.blockedByTaskId,
    });
    broadcast({ type: "tasks", taskId });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/tasks/:id/dependencies/:depId", requireAuth, async (req, res) => {
    await db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.id, Number(req.params.depId)),
          eq(taskDependencies.taskId, Number(req.params.id)),
        ),
      );
    broadcast({ type: "tasks", taskId: Number(req.params.id) });
    res.json({ ok: true });
  });
}
