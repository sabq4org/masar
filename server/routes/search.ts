import type { Express } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { tasks, projects, users } from "../../shared/schema";
import { requireAuth } from "../auth";

/** البحث الشامل (شريط البحث العلوي — نموذج أسانا) */
export function registerSearchRoutes(app: Express) {
  app.get("/api/search", requireAuth, async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) return res.json({ tasks: [], projects: [], users: [] });
    const like = `%${q}%`;

    const [taskRows, projectRows, userRows] = await Promise.all([
      db.query.tasks.findMany({
        where: and(
          eq(tasks.isArchived, false),
          or(ilike(tasks.title, like), ilike(tasks.description, like))!,
        ),
        with: {
          project: { columns: { id: true, name: true, color: true } },
          assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        },
        columns: { id: true, title: true, isCompleted: true, dueAt: true },
        orderBy: [desc(tasks.updatedAt)],
        limit: 10,
      }),
      db
        .select({ id: projects.id, name: projects.name, color: projects.color })
        .from(projects)
        .where(and(eq(projects.status, "active"), ilike(projects.name, like)))
        .limit(6),
      db
        .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, avatarUrl: users.avatarUrl })
        .from(users)
        .where(and(eq(users.isActive, true), ilike(users.name, like)))
        .limit(6),
    ]);

    res.json({ tasks: taskRows, projects: projectRows, users: userRows });
  });
}
