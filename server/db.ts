import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

// SSL مطلوب للقواعد السحابية (Neon…) ومعطّل تلقائيًا للتطوير المحلي
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: 10,
});

export const db = drizzle(pool, { schema });
