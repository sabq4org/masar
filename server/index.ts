import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupSession, registerAuthRoutes } from "./auth";
import { registerMetaRoutes } from "./routes/meta";
import { registerProjectRoutes } from "./routes/projects";
import { registerTaskRoutes } from "./routes/tasks";
import { registerMyTasksRoutes } from "./routes/mytasks";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerUserAdminRoutes } from "./routes/users";
import { registerReportRoutes } from "./routes/reports";
import { registerTemplateRoutes } from "./routes/templates";
import { registerSearchRoutes } from "./routes/search";
import { registerStreamRoutes } from "./routes/stream";
import { registerAiRoutes } from "./routes/ai";
import { startJobs } from "./jobs";
import { pool } from "./db";

// حارس عملية: سجّل ولا تُسقط الخادم (الأخطاء المعالجة تمر عبر معالج Express)
process.on("unhandledRejection", (reason) =>
  console.error("[masar] unhandledRejection:", reason),
);
process.on("uncaughtException", (err) =>
  console.error("[masar] uncaughtException:", err),
);

const app = express();
app.use(express.json({ limit: "2mb" }));
setupSession(app);

registerAuthRoutes(app);
registerMetaRoutes(app);
registerProjectRoutes(app);
registerTaskRoutes(app);
registerMyTasksRoutes(app);
registerNotificationRoutes(app);
registerUserAdminRoutes(app);
registerReportRoutes(app);
registerTemplateRoutes(app);
registerSearchRoutes(app);
// المرفقات اختيارية عند غياب multer — لا تُسقط باقي الـ API
try {
  const { registerAttachmentRoutes } = await import("./routes/attachments");
  registerAttachmentRoutes(app);
} catch (err) {
  console.error("[masar] تعذّر تحميل مسارات المرفقات (npm install؟):", err);
}
registerStreamRoutes(app);
registerAiRoutes(app);
startJobs();

app.get("/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// إنتاجيًا: تقديم الواجهة المبنية من dist/public
if (process.env.NODE_ENV === "production") {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(dirname, "../dist/public");
  app.use(express.static(publicDir));
  // Express 5: بدل نمط "*" — fallback وسيط لكل ما ليس API
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads"))
      return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[masar] unhandled error:", err);
    res.status(500).json({ error: "خطأ غير متوقع" });
  },
);

const port = Number(process.env.PORT) || 5180;
app.listen(port, () => {
  console.log(`مسار يعمل على المنفذ ${port}`);
});
