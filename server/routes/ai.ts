import type { Express } from "express";
import { z } from "zod";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { projects, projectSections, tasks, users } from "../../shared/schema";
import { requireAuth, requirePermission, getSessionUser } from "../auth";
import { PERMISSIONS } from "../permissions";
import { aiEnabled, aiJson, aiText } from "../services/aiService";
import { logActivity } from "../services/tasksService";
import { broadcast } from "../services/events";

function guardAi(res: any): boolean {
  if (!aiEnabled()) {
    res.status(503).json({
      error: "ميزات الذكاء الاصطناعي غير مفعّلة — أضف OPENAI_API_KEY في متغيرات البيئة",
    });
    return false;
  }
  return true;
}

export function registerAiRoutes(app: Express) {
  app.get("/api/ai/status", requireAuth, (_req, res) => {
    res.json({ enabled: aiEnabled() });
  });

  // تحويل وصف مشروع إلى خطة أقسام ومهام
  app.post(
    "/api/ai/plan-project",
    requirePermission(PERMISSIONS.PROJECTS_MANAGE),
    async (req, res) => {
      if (!guardAi(res)) return;
      const parsed = z
        .object({ projectId: z.number().int(), brief: z.string().min(10).max(4000) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "اكتب وصفًا لا يقل عن ١٠ أحرف" });
      const user = (req as any).user;

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, parsed.data.projectId));
      if (!project) return res.status(404).json({ error: "المشروع غير موجود" });

      try {
        const plan = await aiJson<{
          sections: Array<{ title: string; tasks: Array<{ title: string; priority: string }> }>;
        }>(
          `أنت مخطط عمل في فريق إعلامي عربي. حوّل وصف المشروع إلى خطة عملية.
أرجع JSON فقط بالشكل: {"sections":[{"title":"...","tasks":[{"title":"...","priority":"low|normal|high|urgent"}]}]}
بين 2 و5 أقسام، وبين 2 و6 مهام لكل قسم، بعناوين عربية عملية قصيرة قابلة للتنفيذ.`,
          `المشروع: ${project.name}\nالنوع: ${project.type}\nالوصف: ${parsed.data.brief}`,
        );

        let created = 0;
        for (const [si, section] of plan.sections.slice(0, 6).entries()) {
          const [sec] = await db
            .insert(projectSections)
            .values({ projectId: project.id, title: section.title.slice(0, 120), orderIndex: 100 + si })
            .returning();
          const rows = section.tasks.slice(0, 8).map((t, ti) => ({
            title: t.title.slice(0, 300),
            priority: ["low", "normal", "high", "urgent"].includes(t.priority)
              ? t.priority
              : null,
            projectId: project.id,
            sectionId: sec.id,
            orderIndex: ti,
            createdById: user.id,
          }));
          if (rows.length) {
            await db.insert(tasks).values(rows);
            created += rows.length;
          }
        }
        broadcast({ type: "tasks", projectId: project.id });
        res.json({ ok: true, sections: plan.sections.length, tasks: created });
      } catch (e: any) {
        res.status(502).json({ error: e.message });
      }
    },
  );

  // تقسيم مهمة كبيرة إلى مهام فرعية مقترحة (المهام الفرعية مهام كاملة)
  app.post("/api/ai/split-task", requireAuth, async (req, res) => {
    if (!guardAi(res)) return;
    const parsed = z.object({ taskId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const user = await getSessionUser(req);

    const [task] = await db.select().from(tasks).where(eq(tasks.id, parsed.data.taskId));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

    try {
      const result = await aiJson<{ subtasks: string[] }>(
        `أنت محرر تنفيذي في فريق إعلامي عربي. قسّم المهمة إلى خطوات فرعية عملية.
أرجع JSON فقط: {"subtasks":["...", "..."]} — بين 3 و7 خطوات قصيرة مرتبة منطقيًا.`,
        `المهمة: ${task.title}\n${task.description ? "التفاصيل: " + task.description : ""}`,
      );
      const rows = result.subtasks.slice(0, 8).map((title, i) => ({
        title: title.slice(0, 300),
        parentTaskId: task.id,
        projectId: task.projectId,
        departmentId: task.departmentId,
        createdById: user?.id ?? null,
        orderIndex: 100 + i,
      }));
      if (rows.length) await db.insert(tasks).values(rows);
      await logActivity(task.id, user?.id ?? null, "ai_split", { count: rows.length });
      broadcast({ type: "tasks", taskId: task.id });
      res.json({ ok: true, count: rows.length });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // الملخص اليومي
  app.get(
    "/api/ai/daily-brief",
    requirePermission(PERMISSIONS.REPORTS_VIEW),
    async (_req, res) => {
      if (!guardAi(res)) return;

      const [[counts], overdueTasks, pendingApprovals] = await Promise.all([
        db
          .select({
            open: sql<number>`count(*) filter (where not ${tasks.isCompleted})`,
            overdue: sql<number>`count(*) filter (where not ${tasks.isCompleted} and ${tasks.dueAt} < now())`,
            done24h: sql<number>`count(*) filter (where ${tasks.completedAt} >= now() - interval '24 hours')`,
          })
          .from(tasks)
          .where(eq(tasks.isArchived, false)),
        db
          .select({ title: tasks.title, dueAt: tasks.dueAt, assigneeId: tasks.assigneeId })
          .from(tasks)
          .where(
            and(
              eq(tasks.isArchived, false),
              eq(tasks.isCompleted, false),
              lt(tasks.dueAt, new Date()),
            ),
          )
          .limit(15),
        db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.isArchived, false),
              eq(tasks.taskType, "approval"),
              eq(tasks.approvalStatus, "pending"),
            ),
          ),
      ]);

      const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
      const nameOf = (id: number | null) => allUsers.find((u) => u.id === id)?.name ?? "غير مسندة";

      const factSheet = [
        `المهام المفتوحة: ${counts.open} — منها متأخرة: ${counts.overdue}`,
        `أُنجز خلال 24 ساعة: ${counts.done24h}`,
        `اعتمادات معلقة: ${pendingApprovals.length}`,
        "المتأخرات: " +
          (overdueTasks.length
            ? overdueTasks.map((t) => `«${t.title}» (${nameOf(t.assigneeId)})`).join("؛ ")
            : "لا شيء"),
      ].join("\n");

      try {
        const brief = await aiText(
          `أنت مساعد قائد الفريق في منصة «مسار». اكتب ملخصًا صباحيًا تنفيذيًا بالعربية من الحقائق المعطاة فقط — لا تختلق أرقامًا.
البنية: فقرة موجزة عن الوضع العام، ثم «يحتاج تدخلك اليوم» بنقاط (إن وجد)، ثم توصية واحدة عملية. أقل من 150 كلمة.`,
          factSheet,
        );
        res.json({ brief, generatedAt: new Date().toISOString() });
      } catch (e: any) {
        res.status(502).json({ error: e.message });
      }
    },
  );
}
