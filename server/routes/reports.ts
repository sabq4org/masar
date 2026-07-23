import type { Express } from "express";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { tasks, statuses, users, departments } from "../../shared/schema";
import { requireAuth } from "../auth";

export function registerReportRoutes(app: Express) {
  app.get("/api/reports/overview", requireAuth, async (_req, res) => {
    const allStatuses = await db.select().from(statuses);
    const openStatusIds = allStatuses
      .filter((s) => s.category !== "done" && s.category !== "closed")
      .map((s) => s.id);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400_000);
    const notArchived = eq(tasks.isArchived, false);
    const isOpen = inArray(tasks.statusId, openStatusIds);

    const [byStatus, [totals], byDepartment, byUser] = await Promise.all([
      db
        .select({ statusId: tasks.statusId, count: sql<number>`count(*)` })
        .from(tasks)
        .where(notArchived)
        .groupBy(tasks.statusId),
      db
        .select({
          open: sql<number>`count(*) filter (where ${inArray(tasks.statusId, openStatusIds)})`,
          overdue: sql<number>`count(*) filter (where ${inArray(tasks.statusId, openStatusIds)} and ${tasks.dueAt} < now())`,
          dueToday: sql<number>`count(*) filter (where ${inArray(tasks.statusId, openStatusIds)} and ${tasks.dueAt}::date = now()::date)`,
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
          open: sql<number>`count(*) filter (where ${inArray(tasks.statusId, openStatusIds)})`,
          overdue: sql<number>`count(*) filter (where ${inArray(tasks.statusId, openStatusIds)} and ${tasks.dueAt} < now())`,
          done: sql<number>`count(*) filter (where not ${inArray(tasks.statusId, openStatusIds)})`,
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
          open: sql<number>`count(*)`,
          overdue: sql<number>`count(*) filter (where ${tasks.dueAt} < now())`,
        })
        .from(tasks)
        .innerJoin(users, eq(tasks.assigneeId, users.id))
        .where(and(notArchived, isOpen))
        .groupBy(users.id, users.name, users.avatarColor)
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
      byStatus: allStatuses
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => ({
          ...s,
          count: Number(byStatus.find((r) => r.statusId === s.id)?.count ?? 0),
        })),
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
    });
  });

  // تصدير CSV (بترويسة UTF-8 BOM ليقرأه Excel بالعربية)
  app.get("/api/tasks/export.csv", requireAuth, async (_req, res) => {
    const allStatuses = await db.select().from(statuses);
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const allDeps = await db.select().from(departments);
    const list = await db.query.tasks.findMany({
      where: eq(tasks.isArchived, false),
      with: { project: { columns: { name: true } } },
      limit: 5000,
    });
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const header = ["المعرف", "العنوان", "الحالة", "الأولوية", "المسؤول", "الفريق", "المشروع", "الاستحقاق", "أُنشئت"];
    const rows = list.map((t) =>
      [
        t.id,
        t.title,
        allStatuses.find((s) => s.id === t.statusId)?.nameAr ?? "",
        t.priority,
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

  // مهام تحتاج انتباهًا: متأخرة أو بانتظار الاعتماد
  app.get("/api/reports/attention", requireAuth, async (_req, res) => {
    const allStatuses = await db.select().from(statuses);
    const openIds = allStatuses
      .filter((s) => s.category !== "done" && s.category !== "closed")
      .map((s) => s.id);
    const approvalId = allStatuses.find((s) => s.key === "awaiting_approval")?.id;

    const overdue = await db.query.tasks.findMany({
      where: and(
        eq(tasks.isArchived, false),
        inArray(tasks.statusId, openIds),
        isNotNull(tasks.dueAt),
        lt(tasks.dueAt, new Date()),
      ),
      with: {
        status: true,
        assignee: { columns: { id: true, name: true, avatarColor: true } },
        project: { columns: { id: true, name: true, color: true } },
      },
      orderBy: (t, { asc }) => [asc(t.dueAt)],
      limit: 15,
    });

    const awaitingApproval = approvalId
      ? await db.query.tasks.findMany({
          where: and(eq(tasks.isArchived, false), eq(tasks.statusId, approvalId)),
          with: {
            status: true,
            assignee: { columns: { id: true, name: true, avatarColor: true } },
            project: { columns: { id: true, name: true, color: true } },
          },
          orderBy: (t, { asc }) => [asc(t.updatedAt)],
          limit: 15,
        })
      : [];

    res.json({ overdue, awaitingApproval });
  });
}
