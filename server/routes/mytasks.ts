import type { Express } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { userTaskSections, tasks } from "../../shared/schema";
import { requireAuth, getSessionUser } from "../auth";
import { ensureMyTaskSections } from "../services/tasksService";
import { broadcast } from "../services/events";

/** أقسام «مهامي» الشخصية — نموذج أسانا */
export function registerMyTasksRoutes(app: Express) {
  app.get("/api/my-tasks/sections", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const sections = await ensureMyTaskSections(user.id);
    res.json(sections.sort((a, b) => a.orderIndex - b.orderIndex));
  });

  app.post("/api/my-tasks/sections", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z.object({ title: z.string().min(1).max(120) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const existing = await ensureMyTaskSections(user.id);
    const maxOrder = Math.max(...existing.map((s) => s.orderIndex), -1);
    const [section] = await db
      .insert(userTaskSections)
      .values({ userId: user.id, title: parsed.data.title, orderIndex: maxOrder + 1 })
      .returning();
    res.status(201).json(section);
  });

  app.patch("/api/my-tasks/sections/:id", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({ title: z.string().min(1).max(120).optional(), orderIndex: z.number().int().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
    const [updated] = await db
      .update(userTaskSections)
      .set(parsed.data)
      .where(
        and(eq(userTaskSections.id, Number(req.params.id)), eq(userTaskSections.userId, user.id)),
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "القسم غير موجود" });
    res.json(updated);
  });

  app.delete("/api/my-tasks/sections/:id", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const id = Number(req.params.id);
    const [section] = await db
      .select()
      .from(userTaskSections)
      .where(and(eq(userTaskSections.id, id), eq(userTaskSections.userId, user.id)));
    if (!section) return res.status(404).json({ error: "القسم غير موجود" });
    if (section.isDefault)
      return res.status(422).json({ error: "لا يمكن حذف قسم «المسندة حديثًا»" });
    // مهام القسم تعود للقسم الافتراضي (myTasksSectionId = null)
    await db.update(tasks).set({ myTasksSectionId: null }).where(eq(tasks.myTasksSectionId, id));
    await db.delete(userTaskSections).where(eq(userTaskSections.id, id));
    broadcast({ type: "tasks" });
    res.json({ ok: true });
  });
}
