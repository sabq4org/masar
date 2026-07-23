import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../../shared/schema";
import { requireAuth, getSessionUser } from "../auth";

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    const unread = list.filter((n) => !n.isRead).length;
    res.json({ items: list, unread });
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, Number(req.params.id)), eq(notifications.userId, user.id)),
      );
    res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, user.id));
    res.json({ ok: true });
  });
}
