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
  { key: "idea", nameAr: "فكرة", color: "#5B6770", category: "planning", isDefault: true },
  { key: "awaiting_assignment", nameAr: "بانتظار التكليف", color: "#475569", category: "planning" },
  { key: "assigned", nameAr: "مكلّفة", color: "#4338CA", category: "active" },
  { key: "in_progress", nameAr: "قيد العمل", color: "#1D4ED8", category: "active" },
  { key: "awaiting_info", nameAr: "بانتظار المعلومات", color: "#92600A", category: "blocked" },
  { key: "editing", nameAr: "قيد التحرير", color: "#6D28D9", category: "review" },
  { key: "proofreading", nameAr: "قيد التدقيق", color: "#7E22CE", category: "review" },
  { key: "awaiting_approval", nameAr: "بانتظار الاعتماد", color: "#9A4D0F", category: "review" },
  { key: "ready", nameAr: "جاهزة للنشر", color: "#0F766E", category: "active" },
  { key: "scheduled", nameAr: "مجدولة", color: "#0E7490", category: "active" },
  { key: "published", nameAr: "منشورة", color: "#047857", category: "done" },
  { key: "deferred", nameAr: "مؤجلة", color: "#57534E", category: "closed" },
  { key: "cancelled", nameAr: "ملغاة", color: "#B91C1C", category: "closed" },
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
  { nameAr: "الأخبار", color: "#2563B6", sortOrder: 1 },
  { nameAr: "المحليات", color: "#0E7490", sortOrder: 2 },
  { nameAr: "الاقتصاد", color: "#0F8A6D", sortOrder: 3 },
  { nameAr: "الرياضة", color: "#5B8A1E", sortOrder: 4 },
  { nameAr: "التقنية", color: "#6D4BD6", sortOrder: 5 },
  { nameAr: "المنوعات", color: "#A333C8", sortOrder: 6 },
  { nameAr: "التحقيقات", color: "#7C2D12", sortOrder: 7 },
  { nameAr: "الفيديو", color: "#B91C50", sortOrder: 8 },
  { nameAr: "الصور", color: "#A16207", sortOrder: 9 },
  { nameAr: "السوشيال ميديا", color: "#C2570B", sortOrder: 10 },
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
