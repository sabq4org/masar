import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { departments, statuses, statusTransitions, users } from "../shared/schema";

// الحالات الثلاث عشرة — ألوان خطة «مسار» §9
const STATUSES: Array<{
  key: string;
  nameAr: string;
  color: string;
  category: string;
  isDefault?: boolean;
}> = [
  { key: "idea", nameAr: "فكرة", color: "#77705F", category: "planning", isDefault: true },
  { key: "awaiting_assignment", nameAr: "بانتظار التكليف", color: "#46536B", category: "planning" },
  { key: "assigned", nameAr: "مكلّفة", color: "#C98A3B", category: "active" },
  { key: "in_progress", nameAr: "قيد العمل", color: "#C2701E", category: "active" },
  { key: "awaiting_info", nameAr: "بانتظار المعلومات", color: "#A87A0E", category: "blocked" },
  { key: "editing", nameAr: "قيد التحرير", color: "#4A7CA5", category: "review" },
  { key: "proofreading", nameAr: "قيد التدقيق", color: "#33658A", category: "review" },
  { key: "awaiting_approval", nameAr: "بانتظار الاعتماد", color: "#274E6D", category: "review" },
  { key: "ready", nameAr: "جاهزة للنشر", color: "#55917A", category: "active" },
  { key: "scheduled", nameAr: "مجدولة", color: "#3F8A69", category: "active" },
  { key: "published", nameAr: "منشورة", color: "#2E7D5B", category: "done" },
  { key: "deferred", nameAr: "مؤجلة", color: "#8C7347", category: "closed" },
  { key: "cancelled", nameAr: "ملغاة", color: "#B0413E", category: "closed" },
];

// الانتقالات المسموحة (المغلقة مسموحة من أي حالة عبر منطق الخدمة)
const TRANSITIONS: Array<[string, string]> = [
  ["idea", "awaiting_assignment"],
  ["awaiting_assignment", "assigned"],
  ["assigned", "in_progress"],
  ["in_progress", "awaiting_info"],
  ["awaiting_info", "in_progress"],
  ["in_progress", "editing"],
  ["editing", "proofreading"],
  ["proofreading", "awaiting_approval"],
  ["proofreading", "editing"], // طلب تعديل من التدقيق
  ["awaiting_approval", "ready"], // اعتماد
  ["awaiting_approval", "editing"], // طلب تعديل — لا يغلق شيئًا
  ["ready", "scheduled"],
  ["ready", "published"],
  ["scheduled", "published"],
];

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

const ADMIN_EMAIL = "sabq4u@gmail.com";
const ADMIN_PASSWORD = "Masar@2026"; // غيّرها بعد أول دخول

async function main() {
  console.log("زرع الحالات…");
  for (const [i, s] of STATUSES.entries()) {
    await db
      .insert(statuses)
      .values({ ...s, orderIndex: i, isSystem: true, isDefault: s.isDefault ?? false })
      .onConflictDoUpdate({
        target: statuses.key,
        set: { nameAr: s.nameAr, color: s.color, category: s.category, orderIndex: i },
      });
  }

  const allStatuses = await db.select().from(statuses);
  const byKey = new Map(allStatuses.map((s) => [s.key, s.id]));

  console.log("زرع الانتقالات…");
  for (const [from, to] of TRANSITIONS) {
    const fromId = byKey.get(from);
    const toId = byKey.get(to);
    if (!fromId || !toId) continue;
    await db
      .insert(statusTransitions)
      .values({ fromStatusId: fromId, toStatusId: toId })
      .onConflictDoNothing();
  }

  console.log("زرع الأقسام…");
  for (const d of DEPARTMENTS) {
    await db.insert(departments).values(d).onConflictDoNothing();
  }

  console.log("إنشاء حساب المدير…");
  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      passwordHash,
      name: "علي الحازمي",
      role: "admin",
      avatarColor: "#1F6FB2",
    });
    console.log(`✔ حساب المدير: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (غيّر كلمة المرور بعد الدخول)`);
  } else {
    console.log("حساب المدير موجود مسبقًا — لم يتغير شيء");
  }

  console.log("اكتمل الزرع ✔");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
