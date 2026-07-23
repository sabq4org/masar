import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { departments, users, userTaskSections } from "../shared/schema";

const DEPARTMENTS: Array<{ nameAr: string; color: string; sortOrder: number }> = [
  { nameAr: "الأخبار", color: "#33658A", sortOrder: 1 },
  { nameAr: "المحليات", color: "#2E7D5B", sortOrder: 2 },
  { nameAr: "الاقتصاد", color: "#A87A0E", sortOrder: 3 },
  { nameAr: "الرياضة", color: "#C2701E", sortOrder: 4 },
  { nameAr: "التقنية", color: "#46536B", sortOrder: 5 },
  { nameAr: "المنوعات", color: "#5D8FB5", sortOrder: 6 },
  { nameAr: "التحقيقات", color: "#274E6D", sortOrder: 7 },
  { nameAr: "الفيديو", color: "#B0413E", sortOrder: 8 },
  { nameAr: "الصور", color: "#77705F", sortOrder: 9 },
  { nameAr: "السوشيال ميديا", color: "#8C5A2E", sortOrder: 10 },
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@masar.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

async function main() {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    console.error(
      "عيّن ADMIN_PASSWORD في .env (٨ أحرف فأكثر) قبل الزرع.\n" +
        "مثال: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run seed",
    );
    process.exit(1);
  }

  console.log("زرع الفرق…");
  for (const d of DEPARTMENTS) {
    await db.insert(departments).values(d).onConflictDoNothing();
  }

  console.log("إنشاء حساب المدير…");
  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  let adminId = existing?.id;
  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const [admin] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        passwordHash,
        name: "علي الحازمي",
        role: "admin",
        avatarColor: "#1F6FB2",
      })
      .returning();
    adminId = admin.id;
    console.log(`✔ حساب المدير: ${ADMIN_EMAIL} (غيّر كلمة المرور بعد أول دخول)`);
  } else {
    console.log("حساب المدير موجود مسبقًا — لم يتغير شيء");
  }

  // أقسام «مهامي» الافتراضية للمدير (تُنشأ لبقية المستخدمين عند أول دخول)
  if (adminId) {
    const sections = await db
      .select()
      .from(userTaskSections)
      .where(eq(userTaskSections.userId, adminId));
    if (!sections.length) {
      await db.insert(userTaskSections).values([
        { userId: adminId, title: "المسندة حديثًا", orderIndex: 0, isDefault: true },
        { userId: adminId, title: "اليوم", orderIndex: 1 },
        { userId: adminId, title: "قادمة", orderIndex: 2 },
        { userId: adminId, title: "لاحقًا", orderIndex: 3 },
      ]);
      console.log("✔ أقسام «مهامي» الافتراضية");
    }
  }

  console.log("اكتمل الزرع ✔");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
