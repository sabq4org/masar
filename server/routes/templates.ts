import type { Express } from "express";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  projectTemplates,
  projects,
  projectSections,
  tasks,
  statuses,
  type TemplateStructure,
} from "../../shared/schema";
import { requirePermission } from "../auth";
import { PERMISSIONS } from "../permissions";
import { broadcast } from "../services/events";

export function registerTemplateRoutes(app: Express) {
  app.get("/api/templates", requirePermission(PERMISSIONS.PROJECTS_MANAGE), async (_req, res) => {
    const list = await db.select().from(projectTemplates).orderBy(desc(projectTemplates.createdAt));
    res.json(list);
  });

  // حفظ مشروع قائم كقالب (البنية: الأقسام + عناوين المهام وأولوياتها)
  app.post(
    "/api/projects/:id/save-template",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const projectId = Number(req.params.id);
      const user = (req as any).user;
      const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ error: "المشروع غير موجود" });

      const sections = await db
        .select()
        .from(projectSections)
        .where(eq(projectSections.projectId, projectId))
        .orderBy(asc(projectSections.orderIndex));
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(asc(tasks.orderIndex));

      const structure: TemplateStructure = {
        sections: sections.map((s) => ({
          title: s.title,
          tasks: projectTasks
            .filter((t) => t.sectionId === s.id && !t.parentTaskId)
            .map((t) => ({ title: t.title, priority: t.priority, description: t.description ?? undefined })),
        })),
      };
      // مهام بلا قسم
      const orphans = projectTasks.filter((t) => !t.sectionId && !t.parentTaskId);
      if (orphans.length)
        structure.sections.push({
          title: "عام",
          tasks: orphans.map((t) => ({ title: t.title, priority: t.priority })),
        });

      const [template] = await db
        .insert(projectTemplates)
        .values({
          name: parsed.data.name,
          description: project.description,
          type: project.type,
          color: project.color,
          structure,
          createdById: user.id,
        })
        .returning();
      res.status(201).json(template);
    },
  );

  // إنشاء مشروع من قالب
  app.post(
    "/api/templates/:id/instantiate",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const parsed = z
        .object({
          name: z.string().min(1).max(200),
          departmentId: z.number().int().nullable().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

      const [template] = await db
        .select()
        .from(projectTemplates)
        .where(eq(projectTemplates.id, id));
      if (!template) return res.status(404).json({ error: "القالب غير موجود" });
      const structure = template.structure as TemplateStructure;

      const [defaultStatus] = await db.select().from(statuses).where(eq(statuses.isDefault, true));
      if (!defaultStatus) return res.status(500).json({ error: "لا توجد حالة افتراضية" });

      const [project] = await db
        .insert(projects)
        .values({
          name: parsed.data.name,
          description: template.description,
          type: template.type,
          color: template.color,
          departmentId: parsed.data.departmentId ?? null,
          ownerId: user.id,
          createdById: user.id,
        })
        .returning();

      for (const [si, section] of structure.sections.entries()) {
        const [sec] = await db
          .insert(projectSections)
          .values({ projectId: project.id, title: section.title, orderIndex: si })
          .returning();
        if (section.tasks.length)
          await db.insert(tasks).values(
            section.tasks.map((t, ti) => ({
              title: t.title,
              description: t.description ?? null,
              priority: (t.priority as any) ?? "normal",
              statusId: defaultStatus.id,
              projectId: project.id,
              sectionId: sec.id,
              orderIndex: ti,
              createdById: user.id,
            })),
          );
      }

      broadcast({ type: "projects", projectId: project.id });
      res.status(201).json(project);
    },
  );

  app.delete(
    "/api/templates/:id",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      await db.delete(projectTemplates).where(eq(projectTemplates.id, Number(req.params.id)));
      res.json({ ok: true });
    },
  );
}
