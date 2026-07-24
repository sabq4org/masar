import type { Express } from "express";
import { desc, eq, or } from "drizzle-orm";
import { db } from "../db";
import {
  taskActivity,
  taskComments,
  tasks,
  users,
  projects,
  projectStatusUpdates,
} from "../../shared/schema";
import { requireAuth, getSessionUser } from "../auth";
import { PERMISSIONS, roleHas } from "../permissions";

/**
 * خط النشاط — سجل كل خطوة في المساحة (نشاط المهام + التعليقات + تحديثات حالة المشاريع).
 * من يملك tasks.view_all (مسؤول النظام، رئيس التحرير…) يرى كل شيء؛
 * غيره يرى نشاطه ونشاط المهام التي يخصّها (مسؤولًا أو منشئًا).
 */
export function registerActivityRoutes(app: Express) {
  app.get("/api/activity", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const canViewAll = roleHas(user.role, PERMISSIONS.VIEW_ALL);

    const mineOnly = or(
      eq(taskActivity.userId, user.id),
      eq(tasks.assigneeId, user.id),
      eq(tasks.createdById, user.id),
    )!;

    const actsQuery = db
      .select({
        id: taskActivity.id,
        action: taskActivity.action,
        detail: taskActivity.detail,
        createdAt: taskActivity.createdAt,
        userId: users.id,
        userName: users.name,
        userColor: users.avatarColor,
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskCompleted: tasks.isCompleted,
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
      })
      .from(taskActivity)
      .innerJoin(tasks, eq(taskActivity.taskId, tasks.id))
      .leftJoin(users, eq(taskActivity.userId, users.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .orderBy(desc(taskActivity.createdAt))
      .limit(limit);

    const commentsQuery = db
      .select({
        id: taskComments.id,
        content: taskComments.content,
        createdAt: taskComments.createdAt,
        userId: users.id,
        userName: users.name,
        userColor: users.avatarColor,
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskCompleted: tasks.isCompleted,
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
      })
      .from(taskComments)
      .innerJoin(tasks, eq(taskComments.taskId, tasks.id))
      .leftJoin(users, eq(taskComments.userId, users.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .orderBy(desc(taskComments.createdAt))
      .limit(limit);

    const commentsMine = or(
      eq(taskComments.userId, user.id),
      eq(tasks.assigneeId, user.id),
      eq(tasks.createdById, user.id),
    )!;

    const [acts, comments, statusUpdates] = await Promise.all([
      canViewAll ? actsQuery : actsQuery.where(mineOnly),
      canViewAll ? commentsQuery : commentsQuery.where(commentsMine),
      db
        .select({
          id: projectStatusUpdates.id,
          statusType: projectStatusUpdates.statusType,
          title: projectStatusUpdates.title,
          createdAt: projectStatusUpdates.createdAt,
          userId: users.id,
          userName: users.name,
          userColor: users.avatarColor,
          projectId: projects.id,
          projectName: projects.name,
          projectColor: projects.color,
        })
        .from(projectStatusUpdates)
        .leftJoin(users, eq(projectStatusUpdates.createdById, users.id))
        .leftJoin(projects, eq(projectStatusUpdates.projectId, projects.id))
        .orderBy(desc(projectStatusUpdates.createdAt))
        .limit(20),
    ]);

    const items = [
      ...acts.map((a) => ({
        key: `a${a.id}`,
        kind: "task" as const,
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt,
        user: a.userId ? { id: a.userId, name: a.userName!, avatarColor: a.userColor! } : null,
        task: { id: a.taskId, title: a.taskTitle, isCompleted: a.taskCompleted },
        project: a.projectId
          ? { id: a.projectId, name: a.projectName!, color: a.projectColor! }
          : null,
      })),
      ...comments.map((c) => ({
        key: `c${c.id}`,
        kind: "comment" as const,
        action: "commented",
        detail: { preview: c.content.slice(0, 100) },
        createdAt: c.createdAt,
        user: c.userId ? { id: c.userId, name: c.userName!, avatarColor: c.userColor! } : null,
        task: { id: c.taskId, title: c.taskTitle, isCompleted: c.taskCompleted },
        project: c.projectId
          ? { id: c.projectId, name: c.projectName!, color: c.projectColor! }
          : null,
      })),
      ...statusUpdates.map((s) => ({
        key: `s${s.id}`,
        kind: "status_update" as const,
        action: "status_update",
        detail: { statusType: s.statusType, title: s.title },
        createdAt: s.createdAt,
        user: s.userId ? { id: s.userId, name: s.userName!, avatarColor: s.userColor! } : null,
        task: null,
        project: s.projectId
          ? { id: s.projectId, name: s.projectName!, color: s.projectColor! }
          : null,
      })),
    ]
      .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
      .slice(0, limit);

    res.json({ items, scope: canViewAll ? "all" : "mine" });
  });
}
