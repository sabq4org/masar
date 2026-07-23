import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const r = await pool.query(
    "select tablename from pg_tables where schemaname='public' order by 1",
  );
  console.log("الجداول:", r.rows.map((x) => x.tablename).join(", "));
  await pool.end();
}
main();
