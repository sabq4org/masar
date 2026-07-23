import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { taskApprovals, tasks, statuses } from "../../shared/schema";
import { requireAuth, getSessionUser } from "../auth";
import { roleHas, PERMISSIONS } from "../permissions";
import { changeStatus, logActivity, notify } from "../services/tasksService";
import { broadcast } from "../services/events";

export function registerApprovalRoutes(app: Express) {
  // طلب اعتماد على مهمة
  app.post("/api/tasks/:id/approvals", requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({ approverId: z.number().int(), note: z.string().max(2000).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });

    const [existing] = await db
      .select()
      .from(taskApprovals)
      .where(and(eq(taskApprovals.taskId, taskId), eq(taskApprovals.state, "pending")));
    if (existing) return res.status(409).json({ error: "يوجد طلب اعتماد معلّق بالفعل" });

    const [approval] = await db
      .insert(taskApprovals)
      .values({
        taskId,
        requestedById: user.id,
        approverId: parsed.data.approverId,
        note: parsed.data.note ?? null,
      })
      .returning();

    // انقل المهمة إلى «بانتظار الاعتماد» إن كان الانتقال مسموحًا — وإلا اترك حالتها
    const [approvalStatus] = await db
      .select()
      .from(statuses)
      .where(eq(statuses.key, "awaiting_approval"));
    if (approvalStatus && task.statusId !== approvalStatus.id) {
      try {
        await changeStatus(task, approvalStatus.id, user);
      } catch {
        /* الانتقال غير مسموح من الحالة الحالية — لا بأس */
      }
    }

    await logActivity(taskId, user.id, "approval_requested", {
      approverId: parsed.data.approverId,
    });
    await notify(
      [parsed.data.approverId],
      "approval_request",
      `طلب اعتماد: «${task.title}»`,
      `من ${user.name}${parsed.data.note ? " — " + parsed.data.note : ""}`,
      taskId,
      user.id,
    );
    broadcast({ type: "tasks", taskId });
    res.status(201).json(approval);
  });

  // طلبات الاعتماد المعلقة عليّ
  app.get("/api/approvals/pending", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const rows = await db
      .select({
        approval: taskApprovals,
        task: tasks,
      })
      .from(taskApprovals)
      .innerJoin(tasks, eq(taskApprovals.taskId, tasks.id))
      .where(and(eq(taskApprovals.approverId, user.id), eq(taskApprovals.state, "pending")))
      .orderBy(desc(taskApprovals.createdAt));
    res.json(rows.map((r) => ({ ...r.approval, task: r.task })));
  });

  // البتّ في طلب اعتماد — «طلب تعديل» يعيد المهمة للتحرير ولا يغلق شيئًا
  app.post("/api/approvals/:id/decide", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const parsed = z
      .object({
        decision: z.enum(["approved", "changes_requested", "rejected"]),
        note: z.string().max(2000).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

    const [approval] = await db.select().from(taskApprovals).where(eq(taskApprovals.id, id));
    if (!approval) return res.status(404).json({ error: "الطلب غير موجود" });
    if (approval.state !== "pending") return res.status(409).json({ error: "سبق البتّ في الطلب" });
    if (approval.approverId !== user.id && !roleHas(user.role, PERMISSIONS.APPROVE))
      return res.status(403).json({ error: "لست المعتمد المعني" });

    const [updated] = await db
      .update(taskApprovals)
      .set({
        state: parsed.data.decision,
        decisionNote: parsed.data.note ?? null,
        decidedAt: new Date(),
      })
      .where(eq(taskApprovals.id, id))
      .returning();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, approval.taskId));
    const DECISION_LABELS: Record<string, string> = {
      approved: "اعتُمدت",
      changes_requested: "طُلبت تعديلات",
      rejected: "رُفضت",
    };

    if (task) {
      await logActivity(task.id, user.id, "approval_decided", {
        decision: parsed.data.decision,
        note: parsed.data.note,
      });
      // تحريك الحالة تلقائيًا وفق القرار (إن سمح الانتقال)
      const targetKey =
        parsed.data.decision === "approved"
          ? "ready"
          : parsed.data.decision === "changes_requested"
            ? "editing"
            : null;
      if (targetKey) {
        const [target] = await db.select().from(statuses).where(eq(statuses.key, targetKey));
        if (target) {
          try {
            await changeStatus(task, target.id, user);
          } catch {
            /* الانتقال غير مسموح — يبقى القرار مسجلًا */
          }
        }
      }
      await notify(
        [approval.requestedById, task.assigneeId ?? 0].filter(Boolean),
        "approval_decision",
        `${DECISION_LABELS[parsed.data.decision]}: «${task.title}»`,
        `بواسطة ${user.name}${parsed.data.note ? " — " + parsed.data.note : ""}`,
        task.id,
        user.id,
      );
    }
    broadcast({ type: "tasks", taskId: approval.taskId });
    res.json(updated);
  });
}
