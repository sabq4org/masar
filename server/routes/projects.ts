import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { projects, projectSections, tasks, statuses } from "../../shared/schema";
import { requireAuth, requirePermission } from "../auth";
import { PERMISSIONS } from "../permissions";

const projectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(["coverage", "file", "campaign", "dev", "ops"]).default("ops"),
  departmentId: z.number().int().nullable().optional(),
  ownerId: z.number().int().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563B6"),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
});

export function registerProjectRoutes(app: Express) {
  app.get("/api/projects", requireAuth, async (req, res) => {
    const archived = req.query.archived === "1";
    const [rows, counts] = await Promise.all([
      db
        .select()
        .from(projects)
        .where(eq(projects.status, archived ? "archived" : "active"))
        .orderBy(desc(projects.createdAt)),
      db
        .select({
          projectId: tasks.projectId,
          total: sql<number>`count(*)`,
          done: sql<number>`count(*) filter (where ${statuses.category} in ('done','closed'))`,
        })
        .from(tasks)
        .innerJoin(statuses, eq(tasks.statusId, statuses.id))
        .where(and(eq(tasks.isArchived, false), isNotNull(tasks.projectId)))
        .groupBy(tasks.projectId),
    ]);
    const byProject = new Map(counts.map((c) => [c.projectId, c]));
    res.json(
      rows.map((p) => ({
        ...p,
        taskCount: Number(byProject.get(p.id)?.total ?? 0),
        doneCount: Number(byProject.get(p.id)?.done ?? 0),
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
      // أقسام افتراضية خفيفة
      await db.insert(projectSections).values([
        { projectId: project.id, title: "عام", orderIndex: 0 },
      ]);
      res.status(201).json(project);
    },
  );

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return res.status(404).json({ error: "المشروع غير موجود" });
    const sections = await db
      .select()
      .from(projectSections)
      .where(eq(projectSections.projectId, id))
      .orderBy(asc(projectSections.orderIndex));
    res.json({ ...project, sections });
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
      res.json(updated);
    },
  );

  app.post(
    "/api/projects/:id/sections",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const projectId = Number(req.params.id);
      const parsed = z
        .object({ title: z.string().min(1).max(120) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${projectSections.orderIndex}), -1)` })
        .from(projectSections)
        .where(eq(projectSections.projectId, projectId));
      const [section] = await db
        .insert(projectSections)
        .values({ projectId, title: parsed.data.title, orderIndex: Number(maxOrder) + 1 })
        .returning();
      res.status(201).json(section);
    },
  );
}
