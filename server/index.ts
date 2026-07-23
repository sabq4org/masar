import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupSession, registerAuthRoutes } from "./auth";
import { registerMetaRoutes } from "./routes/meta";
import { registerProjectRoutes } from "./routes/projects";
import { registerTaskRoutes } from "./routes/tasks";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerUserAdminRoutes } from "./routes/users";
import { registerReportRoutes } from "./routes/reports";
import { pool } from "./db";

const app = express();
app.use(express.json({ limit: "2mb" }));
setupSession(app);

registerAuthRoutes(app);
registerMetaRoutes(app);
registerProjectRoutes(app);
registerTaskRoutes(app);
registerNotificationRoutes(app);
registerUserAdminRoutes(app);
registerReportRoutes(app);

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
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "غير موجود" });
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
