import type { Express } from "express";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { departments, users, tasks, projects } from "../../shared/schema";
import { requireAuth, requirePermission } from "../auth";
import { PERMISSIONS, roleLabelAr } from "../permissions";

/** بيانات مرجعية: الفرق والمستخدمون */
export function registerMetaRoutes(app: Express) {
  app.get("/api/departments", requireAuth, async (_req, res) => {
    const list = await db
      .select()
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(asc(departments.sortOrder));
    res.json(list);
  });

  // ─── إدارة الفرق (users.manage) ───
  app.post(
    "/api/departments",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({
          nameAr: z.string().min(1).max(80),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#33658A"),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [existing] = await db
        .select()
        .from(departments)
        .where(eq(departments.nameAr, parsed.data.nameAr.trim()));
      if (existing) {
        if (!existing.isActive) {
          const [revived] = await db
            .update(departments)
            .set({ isActive: true, color: parsed.data.color })
            .where(eq(departments.id, existing.id))
            .returning();
          return res.status(201).json(revived);
        }
        return res.status(409).json({ error: "يوجد فريق بهذا الاسم" });
      }
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${departments.sortOrder}), 0)` })
        .from(departments);
      const [dep] = await db
        .insert(departments)
        .values({
          nameAr: parsed.data.nameAr.trim(),
          color: parsed.data.color,
          sortOrder: Number(maxOrder) + 1,
        })
        .returning();
      res.status(201).json(dep);
    },
  );

  app.patch(
    "/api/departments/:id",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({
          nameAr: z.string().min(1).max(80).optional(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          isActive: z.boolean().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [dep] = await db
        .update(departments)
        .set(parsed.data)
        .where(eq(departments.id, Number(req.params.id)))
        .returning();
      if (!dep) return res.status(404).json({ error: "الفريق غير موجود" });
      res.json(dep);
    },
  );

  app.delete(
    "/api/departments/:id",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const id = Number(req.params.id);
      const [dep] = await db.select().from(departments).where(eq(departments.id, id));
      if (!dep) return res.status(404).json({ error: "الفريق غير موجود" });

      // فك الارتباط ثم الحذف — الأعضاء/المهام/المشاريع تبقى بلا فريق
      await db.update(users).set({ departmentId: null }).where(eq(users.departmentId, id));
      await db.update(tasks).set({ departmentId: null }).where(eq(tasks.departmentId, id));
      await db.update(projects).set({ departmentId: null }).where(eq(projects.departmentId, id));
      await db.delete(departments).where(eq(departments.id, id));
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
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name));
    res.json(
      list.map((u) => ({
        ...u,
        roleLabel: roleLabelAr(u.role),
      })),
    );
  });
}
