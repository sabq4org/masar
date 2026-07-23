import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { statuses, departments, projects } from "../shared/schema";

// هوية «الخطّ الساري» §6: عائلة لونية واحدة لكل مرحلة
// رمادي = ما قبل الانطلاق، زعفراني = عمل جارٍ، كهرماني = انتظار،
// أزرق = مراجعة، أخضر = بلغت الوجهة، أحمر = خرجت من المسار
const STATUS_COLORS: Record<string, string> = {
  idea: "#77705F",
  awaiting_assignment: "#46536B",
  assigned: "#C98A3B",
  in_progress: "#C2701E",
  awaiting_info: "#A87A0E",
  deferred: "#8C7347",
  editing: "#4A7CA5",
  proofreading: "#33658A",
  awaiting_approval: "#274E6D",
  ready: "#55917A",
  scheduled: "#3F8A69",
  published: "#2E7D5B",
  cancelled: "#B0413E",
};

// ألوان الفرق مشتقة من عائلات الهوية — لا ألوان حرّة
const DEPT_COLORS: Record<string, string> = {
  "الأخبار": "#33658A",
  "المحليات": "#2E7D5B",
  "الاقتصاد": "#A87A0E",
  "الرياضة": "#C2701E",
  "التقنية": "#46536B",
  "المنوعات": "#5D8FB5",
  "التحقيقات": "#274E6D",
  "الفيديو": "#B0413E",
  "الصور": "#77705F",
  "السوشيال ميديا": "#8C5A2E",
};

async function main() {
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    await db.update(statuses).set({ color }).where(eq(statuses.key, key));
  }
  console.log("✔ ألوان الحالات");

  for (const [nameAr, color] of Object.entries(DEPT_COLORS)) {
    await db.update(departments).set({ color }).where(eq(departments.nameAr, nameAr));
  }
  console.log("✔ ألوان الفرق");

  // المشاريع التي بقيت على الأزرق الافتراضي القديم
  await db.update(projects).set({ color: "#33658A" }).where(eq(projects.color, "#2563B6"));
  console.log("✔ ألوان المشاريع الافتراضية");

  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
