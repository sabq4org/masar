import type { Express } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { departments, statuses, statusTransitions, users } from "../../shared/schema";
import { requireAuth, requirePermission } from "../auth";
import { PERMISSIONS, ROLE_LABELS_AR } from "../permissions";

/** بيانات مرجعية شبه ثابتة: الحالات، الانتقالات، الأقسام، المستخدمون للاختيار */
export function registerMetaRoutes(app: Express) {
  app.get("/api/statuses", requireAuth, async (_req, res) => {
    const list = await db.select().from(statuses).orderBy(asc(statuses.orderIndex));
    res.json(list);
  });

  app.get("/api/statuses/transitions", requireAuth, async (_req, res) => {
    const list = await db.select().from(statusTransitions);
    res.json(list);
  });

  app.get("/api/departments", requireAuth, async (_req, res) => {
    const list = await db
      .select()
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(asc(departments.sortOrder));
    res.json(list);
  });

  // ─── إدارة سير العمل (workflow.manage) ───
  app.patch(
    "/api/statuses/:id",
    requirePermission(PERMISSIONS.WORKFLOW_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({
          nameAr: z.string().min(1).max(60).optional(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [updated] = await db
        .update(statuses)
        .set(parsed.data)
        .where(eq(statuses.id, Number(req.params.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: "الحالة غير موجودة" });
      res.json(updated);
    },
  );

  app.post(
    "/api/statuses/transitions",
    requirePermission(PERMISSIONS.WORKFLOW_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({ fromStatusId: z.number().int(), toStatusId: z.number().int() })
        .safeParse(req.body);
      if (!parsed.success || parsed.data.fromStatusId === parsed.data.toStatusId)
        return res.status(400).json({ error: "بيانات غير صالحة" });
      await db.insert(statusTransitions).values(parsed.data).onConflictDoNothing();
      res.status(201).json({ ok: true });
    },
  );

  app.delete(
    "/api/statuses/transitions",
    requirePermission(PERMISSIONS.WORKFLOW_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({ fromStatusId: z.coerce.number().int(), toStatusId: z.coerce.number().int() })
        .safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      await db
        .delete(statusTransitions)
        .where(
          and(
            eq(statusTransitions.fromStatusId, parsed.data.fromStatusId),
            eq(statusTransitions.toStatusId, parsed.data.toStatusId),
          ),
        );
      res.json({ ok: true });
    },
  );

  app.get("/api/users", requireAuth, async (_req, res) => {
    const list = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        departmentId: users.departmentId,
        avatarColor: users.avatarColor,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name));
    res.json(list.map((u) => ({ ...u, roleLabel: ROLE_LABELS_AR[u.role as keyof typeof ROLE_LABELS_AR] ?? u.role })));
  });
}
