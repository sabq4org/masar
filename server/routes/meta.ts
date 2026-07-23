import type { Express } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { departments, statuses, statusTransitions, users } from "../../shared/schema";
import { requireAuth } from "../auth";
import { ROLE_LABELS_AR } from "../permissions";

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
