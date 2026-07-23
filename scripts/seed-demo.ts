import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  users,
  projects,
  projectSections,
  projectMembers,
  projectStatusUpdates,
  tasks,
  taskComments,
  taskWatchers,
  userTaskSections,
} from "../shared/schema";

/** بيانات تجريبية لتجربة الواجهة — آمنة للتشغيل المتكرر (تتخطى إن وُجد المشروع) */
async function main() {
  const [existing] = await db.select().from(projects).where(eq(projects.name, "حملة إطلاق المنصة"));
  if (existing) {
    console.log("البيانات التجريبية موجودة مسبقًا — لا شيء أُضيف");
    await pool.end();
    return;
  }

  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) throw new Error("شغّل npm run seed أولًا");

  const demoUsers = [
    { email: "sara@masar.local", name: "سارة العتيبي", role: "editor", avatarColor: "#2E7D5B" },
    { email: "fahad@masar.local", name: "فهد القحطاني", role: "media", avatarColor: "#B0413E" },
    { email: "noura@masar.local", name: "نورة الشمري", role: "dept_head", avatarColor: "#33658A" },
  ];
  const hash = await bcrypt.hash("demo12345", 10);
  const created: number[] = [admin.id];
  for (const u of demoUsers) {
    const [row] = await db
      .insert(users)
      .values({ ...u, passwordHash: hash })
      .onConflictDoNothing()
      .returning();
    if (row) {
      created.push(row.id);
      await db.insert(userTaskSections).values([
        { userId: row.id, title: "المسندة حديثًا", orderIndex: 0, isDefault: true },
        { userId: row.id, title: "اليوم", orderIndex: 1 },
        { userId: row.id, title: "قادمة", orderIndex: 2 },
        { userId: row.id, title: "لاحقًا", orderIndex: 3 },
      ]);
    }
  }
  const allUsers = await db.select().from(users);
  const idOf = (name: string) => allUsers.find((u) => u.name === name)?.id ?? admin.id;

  const day = 86400_000;
  const now = Date.now();

  // ─── مشروع ١: حملة إطلاق ───
  const [p1] = await db
    .insert(projects)
    .values({
      name: "حملة إطلاق المنصة",
      description: "خطة إطلاق مسار: المحتوى، التصميم، الإعلان، وقياس الأثر.",
      type: "campaign",
      color: "#C2701E",
      ownerId: admin.id,
      createdById: admin.id,
      currentStatus: "on_track",
    })
    .returning();
  const p1Sections = await db
    .insert(projectSections)
    .values([
      { projectId: p1.id, title: "التخطيط", orderIndex: 0 },
      { projectId: p1.id, title: "المحتوى", orderIndex: 1 },
      { projectId: p1.id, title: "التصميم", orderIndex: 2 },
      { projectId: p1.id, title: "النشر والقياس", orderIndex: 3 },
    ])
    .returning();
  for (const uid of new Set([admin.id, idOf("سارة العتيبي"), idOf("فهد القحطاني"), idOf("نورة الشمري")]))
    await db.insert(projectMembers).values({ projectId: p1.id, userId: uid }).onConflictDoNothing();

  await db.insert(projectStatusUpdates).values({
    projectId: p1.id,
    createdById: admin.id,
    statusType: "on_track",
    title: "الأسبوع الأول يسير كما خُطط",
    body: "أنهينا خطة المحتوى واعتمدنا الهوية البصرية. التصوير يبدأ الأحد.",
  });

  const t = (
    title: string,
    section: number,
    extra: Partial<typeof tasks.$inferInsert> = {},
  ): typeof tasks.$inferInsert => ({
    title,
    projectId: p1.id,
    sectionId: p1Sections[section].id,
    createdById: admin.id,
    ...extra,
  });

  const inserted = await db
    .insert(tasks)
    .values([
      t("تحديد الجمهور المستهدف والرسائل الأساسية", 0, {
        assigneeId: idOf("نورة الشمري"),
        isCompleted: true,
        completedAt: new Date(now - 2 * day),
        completedById: idOf("نورة الشمري"),
        priority: "high",
        orderIndex: 0,
      }),
      t("اعتماد الخطة الإعلامية للربع", 0, {
        assigneeId: admin.id,
        taskType: "approval",
        approvalStatus: "pending",
        priority: "urgent",
        dueAt: new Date(now + day),
        orderIndex: 1,
      }),
      t("جدول النشر الأسبوعي", 0, {
        assigneeId: idOf("سارة العتيبي"),
        dueAt: new Date(now - day),
        priority: "high",
        orderIndex: 2,
      }),
      t("كتابة نصوص الإعلان الرئيسية", 1, {
        assigneeId: idOf("سارة العتيبي"),
        dueAt: new Date(now),
        priority: "high",
        orderIndex: 0,
        description: "ثلاث نسخ: نسخة قصيرة لإكس، نسخة سناب، ونسخة طويلة للموقع.",
      }),
      t("سلسلة مقالات تعريفية (٣ مقالات)", 1, {
        assigneeId: idOf("سارة العتيبي"),
        dueAt: new Date(now + 3 * day),
        orderIndex: 1,
      }),
      t("تصميم الهوية البصرية للحملة", 2, {
        assigneeId: idOf("فهد القحطاني"),
        isCompleted: true,
        completedAt: new Date(now - day),
        completedById: idOf("فهد القحطاني"),
        priority: "high",
        orderIndex: 0,
      }),
      t("قوالب منشورات السوشيال ميديا", 2, {
        assigneeId: idOf("فهد القحطاني"),
        dueAt: new Date(now + 2 * day),
        priority: "normal",
        orderIndex: 1,
      }),
      t("فيديو تشويقي ٣٠ ثانية", 2, {
        assigneeId: idOf("فهد القحطاني"),
        dueAt: new Date(now + 5 * day),
        priority: "urgent",
        orderIndex: 2,
      }),
      t("إطلاق الحملة على المنصات", 3, {
        assigneeId: admin.id,
        taskType: "milestone",
        dueAt: new Date(now + 7 * day),
        orderIndex: 0,
      }),
      t("تقرير الأداء الأسبوعي", 3, {
        assigneeId: idOf("نورة الشمري"),
        dueAt: new Date(now + 9 * day),
        orderIndex: 1,
      }),
    ])
    .returning();

  // مهام فرعية + تعليق + متعاونون
  const video = inserted.find((x) => x.title.includes("فيديو"));
  if (video) {
    await db.insert(tasks).values([
      { title: "كتابة السيناريو", parentTaskId: video.id, projectId: p1.id, createdById: admin.id, assigneeId: idOf("سارة العتيبي"), isCompleted: true, completedAt: new Date(), orderIndex: 0 },
      { title: "التصوير", parentTaskId: video.id, projectId: p1.id, createdById: admin.id, assigneeId: idOf("فهد القحطاني"), dueAt: new Date(now + 3 * day), orderIndex: 1 },
      { title: "المونتاج والموسيقى", parentTaskId: video.id, projectId: p1.id, createdById: admin.id, orderIndex: 2 },
    ]);
    await db.insert(taskComments).values({
      taskId: video.id,
      userId: idOf("فهد القحطاني"),
      content: "السيناريو جاهز — أحتاج اعتماد اللوكيشن قبل الخميس.",
    });
    await db.insert(taskWatchers).values([
      { taskId: video.id, userId: admin.id },
      { taskId: video.id, userId: idOf("سارة العتيبي") },
    ]);
  }

  // ─── مشروع ٢: تطوير تقني ───
  const [p2] = await db
    .insert(projects)
    .values({
      name: "تطوير الموقع الإلكتروني",
      description: "تحسينات الأداء والـSEO للموقع.",
      type: "dev",
      color: "#33658A",
      ownerId: idOf("نورة الشمري"),
      createdById: admin.id,
    })
    .returning();
  const p2Sections = await db
    .insert(projectSections)
    .values([
      { projectId: p2.id, title: "قائمة الانتظار", orderIndex: 0 },
      { projectId: p2.id, title: "قيد التنفيذ", orderIndex: 1 },
      { projectId: p2.id, title: "مكتملة", orderIndex: 2 },
    ])
    .returning();
  await db.insert(projectMembers).values([
    { projectId: p2.id, userId: admin.id },
    { projectId: p2.id, userId: idOf("نورة الشمري") },
  ]);
  await db.insert(tasks).values([
    { title: "تحسين سرعة الصفحة الرئيسية", projectId: p2.id, sectionId: p2Sections[1].id, assigneeId: admin.id, dueAt: new Date(now + 2 * day), priority: "high", createdById: admin.id, orderIndex: 0 },
    { title: "مراجعة خريطة الموقع sitemap", projectId: p2.id, sectionId: p2Sections[0].id, assigneeId: idOf("نورة الشمري"), priority: "low", createdById: admin.id, orderIndex: 0 },
    { title: "ترقية شهادة الأمان", projectId: p2.id, sectionId: p2Sections[2].id, isCompleted: true, completedAt: new Date(now - 3 * day), createdById: admin.id, orderIndex: 0 },
  ]);

  console.log("زُرعت البيانات التجريبية ✔ — مشروعان و١٦ مهمة وأربعة مستخدمين (كلمة مرور التجريبيين: demo12345)");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
