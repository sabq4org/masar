import type { Express } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "../../shared/schema";
import { requirePermission } from "../auth";
import { PERMISSIONS, ROLES, ROLE_LABELS_AR, ROLE_GROUPS } from "../permissions";

const AVATAR_COLORS = [
  "#33658A", "#2E7D5B", "#A87A0E", "#C2701E", "#46536B",
  "#5D8FB5", "#274E6D", "#B0413E", "#77705F", "#8C5A2E",
];

export function registerUserAdminRoutes(app: Express) {
  app.get(
    "/api/admin/users",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (_req, res) => {
      const list = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          departmentId: users.departmentId,
          avatarColor: users.avatarColor,
          avatarUrl: users.avatarUrl,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(asc(users.name));
      res.json(list);
    },
  );

  app.post(
    "/api/admin/users",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const parsed = z
        .object({
          email: z.string().email(),
          name: z.string().min(1).max(120),
          password: z.string().min(8).max(100),
          role: z.enum(ROLES),
          departmentId: z.number().int().nullable().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "بيانات غير صالحة — كلمة المرور 8 أحرف على الأقل" });

      const email = parsed.data.email.toLowerCase().trim();
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) return res.status(409).json({ error: "البريد مستخدم مسبقًا" });

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const [user] = await db
        .insert(users)
        .values({
          email,
          name: parsed.data.name,
          passwordHash,
          role: parsed.data.role,
          departmentId: parsed.data.departmentId ?? null,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        })
        .returning();
      const { passwordHash: _, ...rest } = user;
      res.status(201).json(rest);
    },
  );

  app.patch(
    "/api/admin/users/:id",
    requirePermission(PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const id = Number(req.params.id);
      const actor = (req as any).user;
      const parsed = z
        .object({
          name: z.string().min(1).max(120).optional(),
          role: z.enum(ROLES).optional(),
          departmentId: z.number().int().nullable().optional(),
          isActive: z.boolean().optional(),
          password: z.string().min(8).max(100).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      if (id === actor.id && parsed.data.isActive === false)
        return res.status(400).json({ error: "لا يمكنك تعطيل حسابك" });

      const { password, ...fields } = parsed.data;
      const set: Record<string, unknown> = { ...fields };
      if (password) set.passwordHash = await bcrypt.hash(password, 10);

      const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
      const { passwordHash: _, ...rest } = updated;
      res.json(rest);
    },
  );

  app.get("/api/roles", requirePermission(PERMISSIONS.USERS_MANAGE), (_req, res) => {
    res.json({
      roles: ROLES.map((r) => ({ value: r, label: ROLE_LABELS_AR[r] })),
      groups: ROLE_GROUPS.map((g) => ({
        label: g.label,
        roles: g.roles.map((r) => ({ value: r, label: ROLE_LABELS_AR[r] })),
      })),
    });
  });
}
