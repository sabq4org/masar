import type { Express } from "express";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { tasks, users, departments, projects } from "../../shared/schema";
import { requireAuth } from "../auth";

export function registerReportRoutes(app: Express) {
  app.get("/api/reports/overview", requireAuth, async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const notArchived = eq(tasks.isArchived, false);
    const isOpen = eq(tasks.isCompleted, false);

    const [[totals], byDepartment, byUser, byProject] = await Promise.all([
      db
        .select({
          open: sql<number>`count(*) filter (where not ${tasks.isCompleted})`,
          overdue: sql<number>`count(*) filter (where not ${tasks.isCompleted} and ${tasks.dueAt} < now())`,
          dueToday: sql<number>`count(*) filter (where not ${tasks.isCompleted} and ${tasks.dueAt}::date = now()::date)`,
          done7d: sql<number>`count(*) filter (where ${tasks.completedAt} >= ${weekAgo})`,
          total: sql<number>`count(*)`,
        })
        .from(tasks)
        .where(notArchived),
      db
        .select({
          id: departments.id,
          nameAr: departments.nameAr,
          color: departments.color,
          open: sql<number>`count(*) filter (where not ${tasks.isCompleted})`,
          overdue: sql<number>`count(*) filter (where not ${tasks.isCompleted} and ${tasks.dueAt} < now())`,
          done: sql<number>`count(*) filter (where ${tasks.isCompleted})`,
        })
        .from(tasks)
        .innerJoin(departments, eq(tasks.departmentId, departments.id))
        .where(notArchived)
        .groupBy(departments.id, departments.nameAr, departments.color),
      db
        .select({
          id: users.id,
          name: users.name,
          avatarColor: users.avatarColor,
          avatarUrl: users.avatarUrl,
          open: sql<number>`count(*)`,
          overdue: sql<number>`count(*) filter (where ${tasks.dueAt} < now())`,
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(notArchived, isOpen))
        .groupBy(users.id, users.name, users.avatarColor, users.avatarUrl)
        .orderBy(sql`count(*) desc`),
      db
        .select({
          id: projects.id,
          name: projects.name,
          color: projects.color,
          open: sql<number>`count(*) filter (where not ${tasks.isCompleted})`,
          done: sql<number>`count(*) filter (where ${tasks.isCompleted})`,
          overdue: sql<number>`count(*) filter (where not ${tasks.isCompleted} and ${tasks.dueAt} < now())`,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(notArchived, eq(projects.status, "active")))
        .groupBy(projects.id, projects.name, projects.color)
        .orderBy(sql`count(*) desc`),
    ]);

    res.json({
      totals: {
        open: Number(totals.open),
        overdue: Number(totals.overdue),
        dueToday: Number(totals.dueToday),
        done7d: Number(totals.done7d),
        total: Number(totals.total),
      },
      byDepartment: byDepartment.map((d) => ({
        ...d,
        open: Number(d.open),
        overdue: Number(d.overdue),
        done: Number(d.done),
      })),
      byUser: byUser.map((u) => ({
        ...u,
        open: Number(u.open),
        overdue: Number(u.overdue),
      })),
      byProject: byProject.map((p) => ({
        ...p,
        open: Number(p.open),
        done: Number(p.done),
        overdue: Number(p.overdue),
      })),
    });
  });

  // تصدير CSV (بترويسة UTF-8 BOM ليقرأه Excel بالعربية)
  app.get("/api/tasks/export.csv", requireAuth, async (_req, res) => {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const allDeps = await db.select().from(departments);
    const list = await db.query.tasks.findMany({
      where: eq(tasks.isArchived, false),
      with: { project: { columns: { name: true } } },
      limit: 5000,
    });
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const PRIORITY: Record<string, string> = {
      low: "منخفضة",
      normal: "متوسطة",
      high: "عالية",
      urgent: "عاجلة",
    };
    const header = ["المعرف", "العنوان", "مكتملة", "الأولوية", "المسؤول", "الفريق", "المشروع", "الاستحقاق", "أُنشئت"];
    const rows = list.map((t) =>
      [
        t.id,
        t.title,
        t.isCompleted ? "نعم" : "لا",
        t.priority ? PRIORITY[t.priority] ?? t.priority : "",
        allUsers.find((u) => u.id === t.assigneeId)?.name ?? "",
        allDeps.find((d) => d.id === t.departmentId)?.nameAr ?? "",
        (t as any).project?.name ?? "",
        t.dueAt ? t.dueAt.toISOString().slice(0, 16).replace("T", " ") : "",
        t.createdAt.toISOString().slice(0, 10),
      ]
        .map(esc)
        .join(","),
    );
    const csv = "﻿" + [header.map(esc).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=masar-tasks.csv");
    res.send(csv);
  });

  // مهام تحتاج انتباهًا: متأخرة أو اعتمادات معلقة
  app.get("/api/reports/attention", requireAuth, async (_req, res) => {
    const overdue = await db.query.tasks.findMany({
      where: and(
        eq(tasks.isArchived, false),
        eq(tasks.isCompleted, false),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, new Date()),
      ),
      with: {
        assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        project: { columns: { id: true, name: true, color: true } },
      },
      orderBy: (t, { asc }) => [asc(t.dueAt)],
      limit: 15,
    });

    const awaitingApproval = await db.query.tasks.findMany({
      where: and(
        eq(tasks.isArchived, false),
        eq(tasks.isCompleted, false),
        eq(tasks.taskType, "approval"),
        eq(tasks.approvalStatus, "pending"),
      ),
      with: {
        assignee: { columns: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        project: { columns: { id: true, name: true, color: true } },
      },
      orderBy: (t, { asc }) => [asc(t.updatedAt)],
      limit: 15,
    });

    res.json({ overdue, awaitingApproval });
  });
}
