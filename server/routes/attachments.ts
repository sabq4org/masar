import type { Express } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { attachments, tasks } from "../../shared/schema";
import { requireAuth, getSessionUser } from "../auth";
import { logActivity } from "../services/tasksService";
import { broadcast } from "../services/events";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB مثل حد أسانا التقريبي
});

export function registerAttachmentRoutes(app: Express) {
  // الملفات المرفوعة — خلف تسجيل الدخول
  app.use("/uploads", requireAuth, express.static(UPLOADS_DIR, { maxAge: "7d" }));

  app.post(
    "/api/tasks/:id/attachments",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      const taskId = Number(req.params.id);
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "غير مسجل" });
      if (!req.file) return res.status(400).json({ error: "لم يصل ملف" });
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: "المهمة غير موجودة" });
      }
      // multer يخزن الاسم الأصلي بترميز latin1 — نعيده UTF-8 للأسماء العربية
      const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
      const [row] = await db
        .insert(attachments)
        .values({
          taskId,
          fileName: req.file.filename,
          originalName,
          mime: req.file.mimetype,
          size: req.file.size,
          uploadedById: user.id,
        })
        .returning();
      await logActivity(taskId, user.id, "attachment_added", { name: originalName });
      broadcast({ type: "tasks", taskId });
      res.status(201).json(row);
    },
  );

  app.delete("/api/attachments/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!row) return res.status(404).json({ error: "المرفق غير موجود" });
    await db.delete(attachments).where(eq(attachments.id, id));
    fs.unlink(path.join(UPLOADS_DIR, row.fileName), () => {});
    broadcast({ type: "tasks", taskId: row.taskId });
    res.json({ ok: true });
  });
}
