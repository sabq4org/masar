import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { alias } from "drizzle-orm/pg-core";
import {
  tasks,
  subtasks,
  taskComments,
  taskWatchers,
  taskActivity,
  taskDependencies,
  taskApprovals,
  users,
  statuses,
} from "../../shared/schema";
import { broadcast } from "../services/events";
import { requireAuth, requirePermission, getSessionUser } from "../auth";
import { PERMISSIONS, roleHas } from "../permissions";
import {
  changeStatus,
  allowedNextStatuses,
  logActivity,
  notify,
  taskAudience,
} from "../services/tasksService";

const taskInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).nullable().optional(),
  statusId: z.number().int().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigneeId: z.number().int().nullable().optional(),
  departmentId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  sectionId: z.number().int().nullable().optional(),
  parentTaskId: z.number().int().nullable().optional(),
  startAt: z.coerce.date().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  linkUrl: z.string().url().max(1000).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  sourceType: z.enum(["meeting", "message", "alert", "manual"]).optional(),
  sourceRef: z.string().max(500).optional(),
});

export function registerTaskRoutes(app: Express) {
  // ─── قائمة المهام بفلاتر ───
  app.get("/api/tasks", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });

    const q = req.query;
    const filters: SQL[] = [eq(tasks.isArchived, q.archived === "1" ? true : false)];

    // من لا يملك view_all يرى مهامه فقط (مسؤولًا أو منشئًا)
    const canViewAll = roleHas(user.role, PERMISSIONS.VIEW_ALL);
    if (!canViewAll || q.mine === "1") {
      filters.push(
        or(eq(tasks.assigneeId, user.id), eq(tasks.createdById, user.id))!,
      );
    }
    if (q.projectId) filters.push(eq(tasks.projectId, Number(q.projectId)));
    if (q.statusId) filters.push(eq(tasks.statusId, Number(q.statusId)));
    if (q.assigneeId) filters.push(eq(tasks.assigneeId, Number(q.assigneeId)));
    if (q.departmentId) filters.push(eq(tasks.departmentId, Number(q.departmentId)));
    if (q.parentId) filters.push(eq(tasks.parentTaskId, Number(q.parentId)));
    else if (q.roots === "1") filters.push(isNull(tasks.parentTaskId));
    if (typeof q.q === "string" && q.q.trim())
      filters.push(ilike(tasks.title, `%${q.q.trim()}%`));

    const limit = Math.min(Number(q.limit) || 200, 500);
    const list = await db.query.tasks.findMany({
      where: and(...filters),
      with: {
        status: true,
        assignee: { columns: { id: true, name: true, avatarColor: true } },
        project: { columns: { id: true, name: true, color: true } },
      },
      orderBy: [asc(tasks.orderIndex), desc(tasks.createdAt)],
      limit,
    });
    res.json(list);
  });

  // ─── إنشاء مهمة ───
  app.post("/api/tasks", requirePermission(PERMISSIONS.CREATE), async (req, res) => {
    const parsed = taskInput.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "بيانات غير صالحة", detail: parsed.error.flatten() });
    const user = (req as any).user;

    let statusId = parsed.data.statusId;
    if (!statusId) {
      const [def] = await db.select().from(statuses).where(eq(statuses.isDefault, true));
      statusId = def?.id;
    }
    if (!statusId) return res.status(500).json({ error: "لا توجد حالة افتراضية" });

    const [task] = await db
      .insert(tasks)
      .values({
        ...parsed.data,
        statusId,
        tags: parsed.data.tags ?? [],
        createdById: user.id,
        departmentId: parsed.data.departmentId ?? user.departmentId,
      })
      .returning();

    await logActivity(task.id, user.id, "created", { title: task.title });
    if (task.assigneeId && task.assigneeId !== user.id) {
      await notify(
        [task.assigneeId],
        "assigned",
        `كُلّفت بمهمة: «${task.title}»`,
        `بواسطة ${user.name}`,
        task.id,
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
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        status: true,
        assignee: { columns: { id: true, name: true, avatarColor: true } },
        createdBy: { columns: { id: true, name: true } },
        project: { columns: { id: true, name: true, color: true } },
        section: true,
        subtasks: { orderBy: [asc(subtasks.orderIndex)] },
        comments: {
          with: { user: { columns: { id: true, name: true, avatarColor: true } } },
          orderBy: [asc(taskComments.createdAt)],
        },
        watchers: { with: { user: { columns: { id: true, name: true } } } },
        activity: {
          with: { user: { columns: { id: true, name: true } } },
          orderBy: [desc(taskActivity.createdAt)],
          limit: 50,
        },
      },
    });
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    const nextStatuses = await allowedNextStatuses(task.statusId);

    // العوائق: مهام تحجب هذه المهمة، مع حالتها
    const blockers = alias(tasks, "blockers");
    const dependencies = await db
      .select({
        id: taskDependencies.id,
        blockedByTaskId: taskDependencies.blockedByTaskId,
        title: blockers.title,
        statusId: blockers.statusId,
      })
      .from(taskDependencies)
      .innerJoin(blockers, eq(taskDependencies.blockedByTaskId, blockers.id))
      .where(eq(taskDependencies.taskId, id));

    const approvals = await db
      .select()
      .from(taskApprovals)
      .where(eq(taskApprovals.taskId, id))
      .orderBy(desc(taskApprovals.createdAt));

    res.json({ ...task, nextStatuses, dependencies, approvals });
  });

  // ─── الاعتماديات ───
  app.post("/api/tasks/:id/dependencies", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const user = await getSessionUser(req);
    const parsed = z.object({ blockedByTaskId: z.number().int() }).safeParse(req.body);
    if (!parsed.success || parsed.data.blockedByTaskId === taskId)
      return res.status(400).json({ error: "بيانات غير صالحة" });
    // منع الحلقة المباشرة (أ يحجب ب وب يحجب أ)
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
        isArchived: z.boolean().optional(),
        orderIndex: z.number().int().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const { statusId: _ignoreStatus, ...fields } = parsed.data; // الحالة تتغير عبر مسارها الخاص فقط

    const prevAssignee = task.assigneeId;
    const [updated] = await db
      .update(tasks)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    const changedFields = Object.keys(fields);
    if (changedFields.length)
      await logActivity(id, user.id, "updated", { fields: changedFields });

    if (fields.assigneeId !== undefined && fields.assigneeId !== prevAssignee && fields.assigneeId) {
      await notify(
        [fields.assigneeId],
        "assigned",
        `كُلّفت بمهمة: «${updated.title}»`,
        `بواسطة ${user.name}`,
        id,
      );
      await logActivity(id, user.id, "assigned", { assigneeId: fields.assigneeId });
    }
    broadcast({ type: "tasks", taskId: id, projectId: updated.projectId ?? undefined });
    res.json(updated);
  });

  // ─── تغيير الحالة (بفرض الانتقالات) ───
  app.post("/api/tasks/:id/status", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z.object({ statusId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
    try {
      const updated = await changeStatus(task, parsed.data.statusId, user);
      res.json(updated);
    } catch (e: any) {
      res.status(e.status ?? 500).json({ error: e.message });
    }
  });

  // ─── المهام الفرعية ───
  app.post("/api/tasks/:id/subtasks", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const parsed = z.object({ title: z.string().min(1).max(300) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const user = await getSessionUser(req);
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${subtasks.orderIndex}), -1)` })
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId));
    const [row] = await db
      .insert(subtasks)
      .values({ taskId, title: parsed.data.title, orderIndex: Number(maxOrder) + 1 })
      .returning();
    await logActivity(taskId, user?.id ?? null, "subtask_added", { title: row.title });
    res.status(201).json(row);
  });

  app.patch("/api/subtasks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = z
      .object({ isDone: z.boolean().optional(), title: z.string().min(1).max(300).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [row] = await db.update(subtasks).set(parsed.data).where(eq(subtasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: "غير موجودة" });
    res.json(row);
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

    const audience = await taskAudience(task);
    await notify(
      audience,
      "comment",
      `تعليق جديد على «${task.title}»`,
      `${user.name}: ${parsed.data.content.slice(0, 120)}`,
      taskId,
      user.id,
    );
    if (parsed.data.mentions.length)
      await notify(
        parsed.data.mentions,
        "mention",
        `ذكرك ${user.name} في «${task.title}»`,
        parsed.data.content.slice(0, 120),
        taskId,
        user.id,
      );
    res.status(201).json(comment);
  });

  // ─── المشاركون ───
  app.post("/api/tasks/:id/watchers", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    await db
      .insert(taskWatchers)
      .values({ taskId, userId: parsed.data.userId })
      .onConflictDoNothing();
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
    res.json({ ok: true });
  });
}
