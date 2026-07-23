import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  projects,
  projectSections,
  projectMembers,
  projectStars,
  projectStatusUpdates,
  tasks,
  users,
  PROJECT_STATUS_TYPES,
} from "../../shared/schema";
import { requireAuth, requirePermission, getSessionUser } from "../auth";
import { PERMISSIONS } from "../permissions";
import { broadcast } from "../services/events";
import { notify } from "../services/tasksService";

const projectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  type: z.enum(["coverage", "file", "campaign", "dev", "ops"]).default("ops"),
  departmentId: z.number().int().nullable().optional(),
  ownerId: z.number().int().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#33658A"),
  defaultView: z.enum(["overview", "list", "board", "timeline", "calendar"]).optional(),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
});

export function registerProjectRoutes(app: Express) {
  app.get("/api/projects", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const archived = req.query.archived === "1";
    const [rows, counts, stars, members] = await Promise.all([
      db
        .select()
        .from(projects)
        .where(eq(projects.status, archived ? "archived" : "active"))
        .orderBy(desc(projects.createdAt)),
      db
        .select({
          projectId: tasks.projectId,
          total: sql<number>`count(*)`,
          done: sql<number>`count(*) filter (where ${tasks.isCompleted})`,
        })
        .from(tasks)
        .where(and(eq(tasks.isArchived, false), isNotNull(tasks.projectId)))
        .groupBy(tasks.projectId),
      db.select().from(projectStars).where(eq(projectStars.userId, user.id)),
      db
        .select({ projectId: projectMembers.projectId, count: sql<number>`count(*)` })
        .from(projectMembers)
        .groupBy(projectMembers.projectId),
    ]);
    const byProject = new Map(counts.map((c) => [c.projectId, c]));
    const starred = new Set(stars.map((s) => s.projectId));
    const memberCount = new Map(members.map((m) => [m.projectId, Number(m.count)]));
    res.json(
      rows.map((p) => ({
        ...p,
        taskCount: Number(byProject.get(p.id)?.total ?? 0),
        doneCount: Number(byProject.get(p.id)?.done ?? 0),
        memberCount: memberCount.get(p.id) ?? 0,
        isStarred: starred.has(p.id),
      })),
    );
  });

  app.post(
    "/api/projects",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const parsed = projectInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const user = (req as any).user;
      const [project] = await db
        .insert(projects)
        .values({ ...parsed.data, createdById: user.id, ownerId: parsed.data.ownerId ?? user.id })
        .returning();
      // أقسام افتراضية بأسلوب أسانا
      await db.insert(projectSections).values([
        { projectId: project.id, title: "مهام جديدة", orderIndex: 0 },
        { projectId: project.id, title: "قيد التنفيذ", orderIndex: 1 },
        { projectId: project.id, title: "مكتملة", orderIndex: 2 },
      ]);
      await db
        .insert(projectMembers)
        .values({ projectId: project.id, userId: user.id })
        .onConflictDoNothing();
      broadcast({ type: "projects", projectId: project.id });
      res.status(201).json(project);
    },
  );

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });
    const [sections, members, [star], lastUpdate] = await Promise.all([
      db
        .select()
        .from(projectSections)
        .where(eq(projectSections.projectId, id))
        .orderBy(asc(projectSections.orderIndex)),
      db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          name: users.name,
          avatarColor: users.avatarColor,
          avatarUrl: users.avatarUrl,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, id)),
      user
        ? db
            .select()
            .from(projectStars)
            .where(and(eq(projectStars.projectId, id), eq(projectStars.userId, user.id)))
        : Promise.resolve([] as any[]),
      db
        .select()
        .from(projectStatusUpdates)
        .where(eq(projectStatusUpdates.projectId, id))
        .orderBy(desc(projectStatusUpdates.createdAt))
        .limit(1),
    ]);
    res.json({
      ...project,
      sections,
      members,
      isStarred: Boolean(star),
      lastStatusUpdate: lastUpdate[0] ?? null,
    });
  });

  app.patch(
    "/api/projects/:id",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const id = Number(req.params.id);
      const parsed = projectInput
        .partial()
        .extend({ status: z.enum(["active", "archived"]).optional() })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [updated] = await db
        .update(projects)
        .set(parsed.data)
        .where(eq(projects.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "المشروع غير موجود" });
      broadcast({ type: "projects", projectId: id });
      res.json(updated);
    },
  );

  app.delete(
    "/api/projects/:id",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const id = Number(req.params.id);
      // حذف فعلي مثل أسانا — المهام المرتبطة يفك ارتباطها (set null)
      const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "المشروع غير موجود" });
      broadcast({ type: "projects" });
      res.json({ ok: true });
    },
  );

  // ─── المفضلة ───
  app.post("/api/projects/:id/star", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .insert(projectStars)
      .values({ projectId: Number(req.params.id), userId: user.id })
      .onConflictDoNothing();
    broadcast({ type: "projects" });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/projects/:id/star", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .delete(projectStars)
      .where(
        and(eq(projectStars.projectId, Number(req.params.id)), eq(projectStars.userId, user.id)),
      );
    broadcast({ type: "projects" });
    res.json({ ok: true });
  });

  // ─── الأعضاء ───
  app.post("/api/projects/:id/members", requireAuth, async (req, res) => {
    const projectId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z.object({ userId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });
    const [inserted] = await db
      .insert(projectMembers)
      .values({ projectId, userId: parsed.data.userId })
      .onConflictDoNothing()
      .returning();
    if (inserted && parsed.data.userId !== user.id)
      await notify(
        [parsed.data.userId],
        "project_added",
        `أضافك ${user.name} إلى مشروع «${project.name}»`,
        null,
        null,
        user.id,
        user.id,
      );
    broadcast({ type: "projects", projectId });
    res.status(201).json({ ok: true });
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, Number(req.params.id)),
          eq(projectMembers.userId, Number(req.params.userId)),
        ),
      );
    broadcast({ type: "projects", projectId: Number(req.params.id) });
    res.json({ ok: true });
  });

  // ─── تحديثات الحالة ───
  app.get("/api/projects/:id/status-updates", requireAuth, async (req, res) => {
    const rows = await db.query.projectStatusUpdates.findMany({
      where: eq(projectStatusUpdates.projectId, Number(req.params.id)),
      with: { createdBy: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } } },
      orderBy: [desc(projectStatusUpdates.createdAt)],
      limit: 20,
    });
    res.json(rows);
  });

  app.post("/api/projects/:id/status-updates", requireAuth, async (req, res) => {
    const projectId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({
        statusType: z.enum(["on_track", "at_risk", "off_track", "on_hold", "complete"]),
        title: z.string().max(200).nullable().optional(),
        body: z.string().max(10000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });

    const [update] = await db
      .insert(projectStatusUpdates)
      .values({ projectId, createdById: user.id, ...parsed.data })
      .returning();
    await db
      .update(projects)
      .set({ currentStatus: parsed.data.statusType })
      .where(eq(projects.id, projectId));

    // إشعار أعضاء المشروع
    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    const label = PROJECT_STATUS_TYPES[parsed.data.statusType]?.label ?? parsed.data.statusType;
    await notify(
      members.map((m) => m.userId),
      "status_update",
      `حدّث ${user.name} حالة «${project.name}»: ${label}`,
      parsed.data.title ?? null,
      null,
      user.id,
      user.id,
    );
    broadcast({ type: "projects", projectId });
    res.status(201).json(update);
  });

  // ─── أقسام المشروع ───
  app.post("/api/projects/:id/sections", requireAuth, async (req, res) => {
    const projectId = Number(req.params.id);
    const parsed = z.object({ title: z.string().min(1).max(120) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${projectSections.orderIndex}), -1)` })
      .from(projectSections)
      .where(eq(projectSections.projectId, projectId));
    const [section] = await db
      .insert(projectSections)
      .values({ projectId, title: parsed.data.title, orderIndex: Number(maxOrder) + 1 })
      .returning();
    broadcast({ type: "projects", projectId });
    res.status(201).json(section);
  });

  app.patch("/api/sections/:id", requireAuth, async (req, res) => {
    const parsed = z
      .object({ title: z.string().min(1).max(120).optional(), orderIndex: z.number().int().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [updated] = await db
      .update(projectSections)
      .set(parsed.data)
      .where(eq(projectSections.id, Number(req.params.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "القسم غير موجود" });
    broadcast({ type: "projects", projectId: updated.projectId });
    res.json(updated);
  });

  app.delete("/api/sections/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const [section] = await db.select().from(projectSections).where(eq(projectSections.id, id));
    if (!section) return res.status(404).json({ error: "القسم غير موجود" });
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.sectionId, id), eq(tasks.isArchived, false)));
    if (Number(count) > 0)
      return res
        .status(422)
        .json({ error: `القسم يحوي ${count} مهمة — انقلها أو أكملها أولًا` });
    await db.delete(projectSections).where(eq(projectSections.id, id));
    broadcast({ type: "projects", projectId: section.projectId });
    res.json({ ok: true });
  });
}
