import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { users } from "../shared/schema";
import { roleHas, permissionsForRole } from "./permissions";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function setupSession(app: Express) {
  const PgStore = connectPgSimple(session);
  app.set("trust proxy", 1);
  app.use(
    session({
      store: new PgStore({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "masar-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
}

export async function getSessionUser(req: Request) {
  if (!req.session.userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (!user || !user.isActive) return null;
  return user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: "يلزم تسجيل الدخول" });
  next();
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "يلزم تسجيل الدخول" });
    if (!roleHas(user.role, permission))
      return res.status(403).json({ error: "لا تملك صلاحية هذا الإجراء" });
    (req as any).user = user;
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase().trim()));
    if (!user || !user.isActive)
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

    req.session.userId = user.id;
    res.json(publicUser(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "غير مسجل" });
    res.json(publicUser(user));
  });
}

function publicUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...rest } = user;
  return { ...rest, permissions: permissionsForRole(user.role) };
}
